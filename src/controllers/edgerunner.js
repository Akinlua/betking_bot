import { fork } from "child_process";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import configurations from "../../configurations/index.js";
import { createEdgeRunnerConfig } from "../bots/edgerunner/helper.js";
import { client } from "../server.js";
import { ChannelType } from "discord.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Map to store child processes: { botId: ChildProcess }
const bots = new Map();

export async function startBot(req, res) {
    const config = createEdgeRunnerConfig(req.body);
    if (!config.provider.userId || !config.bookmaker.username || !config.bookmaker.password) {
        return res.status(400).json({ error: "Missing required fields: userId, username, password" });
    }

    const botId = config.bookmaker.username;

    if (bots.has(botId)) {
        console.warn(`[Bot] Start request failed: A bot for user [${botId}] is already running or starting.`);
        return res.status(409).json({ error: `A bot for this user is already running or in the process of starting.` });
    }

    const maxAllowedBots = parseInt(configurations.MAX_EDGERUNNER_INSTANCES) || 5;
    if (bots.size >= maxAllowedBots) {
        console.warn(`[Bot] Start request failed: Maximum number of bots reached [${maxAllowedBots}]`);
        return res.status(429).json({ error: `Server has reached its maximum capacity of running bots [${maxAllowedBots}]` });
    }

    bots.set(botId, { status: 'starting' }); // Lock the botId immediately

    const configPath = path.join(__dirname, `../../data/edgerunner/${botId}.json`);
    let channel = null;

    try {
        try {
            await fs.access(configPath);
            const errorMessage = `Bookmaker username ${botId} already has a configuration file. Please delete the bot first.`;
            console.warn(`[Bot] Start request failed: ${errorMessage}`);
            bots.delete(botId); // Release the lock
            return res.status(400).json({ error: errorMessage });
        } catch (error) {
            // File does not exist, which is good.
        }

        const configDir = path.dirname(configPath);
        const guild = await client.guilds.fetch(configurations.DISCORD_GUILD_ID);
        const category = await guild.channels.fetch(configurations.DISCORD_BOTS_CATEGORY_ID);
        
        channel = await guild.channels.create({
            name: `bot-${botId}`,
            type: ChannelType.GuildText,
            parent: category,
            topic: `Logs and status for bot running on account ${botId}.`
        });
        config.discordChannelId = channel.id;

        await fs.mkdir(configDir, { recursive: true });
        await fs.writeFile(configPath, JSON.stringify(config, null, 2));

        const child = fork(path.join(__dirname, "../bots/edgerunner/instance.js"), [], {
            env: { CONFIG_PATH: configPath },
            stdio: ['pipe', 'pipe', 'pipe', 'ipc']
        });

        child.on('message', async (msg) => {
            if (msg.type?.toLowerCase() === 'log' && msg.message) {
                try {
                    const logChannel = await client.channels.fetch(config.discordChannelId);
                    if (logChannel) await logChannel.send(msg.message);
                } catch (err) {
                    console.error(`[Bot ${botId}] Failed to send log:`, err.message);
                }
            }
        });

        child.stdout.on('data', (data) => console.log(`[Bot ${botId}] stdout: ${data.toString().trim()}`));
        child.stderr.on('data', (data) => console.error(`[Bot ${botId}] stderr: ${data.toString().trim()}`));
        child.on('error', (err) => console.error(`[Bot ${botId}] Process error:`, err));
        
        child.on('exit', async (code) => {
            console.log(`[Bot ${botId}] Process exited with code ${code}`);
            bots.delete(botId);
            try {
                await fs.unlink(configPath);
            } catch (err) {
                // Ignore if file is already gone
            }
        });
        
        bots.set(botId, child); // Replace placeholder with the real child process
        return res.json({ message: "Bot started", pm_id: botId, name: `edgerunner-${botId}` });

    } catch (error) {
        console.error(`[Bot] Failed to start bot [${botId}]:`, error);
        bots.delete(botId); // Release the lock on failure
        if (channel) {
            await channel.delete().catch(err => {});
        }
        // Attempt to clean up config file if it was written before the crash
        try { await fs.unlink(configPath); } catch (e) {}

        return res.status(500).json({ error: "Failed to start bot. " + error.message });
    }
}

export async function updateConfig(req, res) {
	const pm_id = req.params.id;
	const partialConfig = req.body;
	const configPath = path.join(__dirname, `../../data/edgerunner/${pm_id}.json`);

	try {
		const child = bots.get(pm_id);
		if (!child) {
			return res.status(404).json({ error: "Bot not found" });
		}

		const existingConfigStr = await fs.readFile(configPath, 'utf8');
		const existingConfig = JSON.parse(existingConfigStr);

		const updatedConfig = {
			...existingConfig,
			provider: { ...existingConfig.provider, ...(partialConfig.provider || {}) },
			bookmaker: { ...existingConfig.bookmaker, ...(partialConfig.bookmaker || {}) },
			edgerunner: {
				...existingConfig.edgerunner,
				...(partialConfig.edgerunner || {}),
				fixedStake: {
					...existingConfig.edgerunner.fixedStake,
					...(partialConfig.edgerunner?.fixedStake || {}),
				},
			},
		};

		await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));
		console.log(`[Bot ${pm_id}] Config updated and saved to ${configPath}`);

		await new Promise((resolve, reject) => {
			// Send only the edgerunner part to the bot process
			child.send({ type: 'config', data: { config: updatedConfig.edgerunner } }, (err) => {
				if (err) return reject(err);
				resolve();
			});
		});

		res.json({ message: "Bot configuration updated", pm_id });
	} catch (error) {
		console.error('[Bot] Failed to update configuration:', error);
		res.status(500).json({ error: "Failed to update configuration" });
	}
}

export async function stopBot(req, res) {
	const pm_id = req.params.id;
	const child = bots.get(pm_id);

	if (!child) {
		const configPath = path.join(__dirname, `../../data/edgerunner/${pm_id}.json`);
		try {
			await fs.unlink(configPath);
			return res.json({ message: "Bot was not running, but orphaned config file was cleaned up.", pm_id });
		} catch (error) {
			return res.status(404).json({ error: "Bot not found" });
		}
	}

	try {
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				child.kill('SIGKILL'); // Force kill
				reject(new Error('Bot did not exit gracefully, was forcefully killed.'));
			}, 5000); // 5-second timeout

			child.once('exit', () => {
				clearTimeout(timeout); // Clear the forceful kill timeout
				resolve();
			});

			child.send({ type: 'stop' });
		});

		res.json({ message: "Bot stopped successfully", pm_id });
	} catch (error) {
		console.error(`[Bot] Error during stop process for ${pm_id}:`, error);
		bots.delete(pm_id);
		res.status(500).json({ error: error.message });
	}
}

export async function listBots(req, res) {
	try {
		const botList = Array.from(bots.entries()).map(([pm_id, child]) => ({
			pm_id,
			name: `edgerunner-${pm_id}`,
			status: child.connected ? 'online' : 'stopped'
		}));
		res.json({ bots: botList });
	} catch (error) {
		console.error('[Bot] Failed to list bots:', error);
		res.status(500).json({ error: "Failed to list bots" });
	}
}

export async function getBotStatus(req, res) {
	const pm_id = req.params.id;
	try {
		const child = bots.get(pm_id);
		if (!child) {
			return res.status(404).json({ error: "Bot not found" });
		}

		const status = await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Status request timed out.'));
			}, 5000); // 5-second timeout

			const onMessage = (msg) => {
				if (msg.type === 'status') {
					clearTimeout(timeout);
					child.removeListener('message', onMessage); // Clean up listener
					resolve(msg.data.status);
				}
			};

			child.on('message', onMessage);

			child.send({ type: 'status' }, (err) => {
				if (err) {
					clearTimeout(timeout);
					child.removeListener('message', onMessage);
					return reject(err);
				}
			});
		});

		res.json({ message: "Bot status", pm_id, ...status });
	} catch (error) {
		console.error(`[Bot] Failed to get bot status for ${pm_id}:`, error);
		res.status(500).json({ error: "Failed to get bot status: " + error.message });
	}
}

export async function deleteBot(req, res) {
	const pm_id = req.params.id;
	console.log(`[Bot] Received delete request for bot [${pm_id}]`);

	try {
		const configPath = path.join(__dirname, `../../data/edgerunner/${pm_id}.json`);
		let config;

		if (bots.has(pm_id)) {
			console.log(`[Bot] Bot ${pm_id} is running. Attempting to stop it first...`);
			const child = bots.get(pm_id);
			await new Promise((resolve) => {
				child.once('exit', resolve);
				child.send({ type: 'stop' });
				setTimeout(() => child.kill(), 2000); // Give it 2s to exit gracefully
			});
			console.log(`[Bot] Process for ${pm_id} stopped.`);
		}

		try {
			config = JSON.parse(await fs.readFile(configPath, 'utf8'));
		} catch (e) {
			console.log(`[Bot] No config file found for ${pm_id}, skipping channel deletion.`);
		}

		if (config && config.discordChannelId) {
			try {
				const channel = await client.channels.fetch(config.discordChannelId);
				await channel.delete();
				console.log(`[Bot] Deleted Discord channel for ${pm_id}.`);
			} catch (error) {
				console.warn(`[Bot] Could not delete Discord channel for ${pm_id} (may have been deleted already):`, error.message);
			}
		}

		try {
			await fs.unlink(configPath);
			console.log(`[Bot] Deleted config file for ${pm_id}.`);
		} catch (error) {
			if (error.code !== 'ENOENT') {
				throw error;
			}
		}

		res.json({ message: `Successfully deleted all data for bot ${pm_id}` });

	} catch (error) {
		console.error(`[Bot] Failed to delete bot ${pm_id}:`, error);
		res.status(500).json({ error: `Failed to delete bot ${pm_id}` });
	}
}
