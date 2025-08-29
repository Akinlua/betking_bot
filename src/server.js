import express from "express";
import morgan from "morgan";
import "dotenv/config.js";
import {
	Client,
	Events,
	Collection,
	GatewayIntentBits,
	MessageFlags,
	REST,
	Routes
} from "discord.js";
import configurations from "../configurations/index.js";
import edgeRunnerRoutes from "./routes/edgerunner.js";
import chalk from "chalk";
import nodeCron from "node-cron";
import path from "path";
import fs from "fs/promises";
import { fileURLToPath } from 'url'

const PORT = configurations.PORT || 9090;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function cleanupOldConfigs() {
	const configDir = path.join(__dirname, '../data/edgerunner');
	try {
		await fs.access(configDir);
		const files = await fs.readdir(configDir);
		const deletePromises = [];
		for (const file of files) {
			if (file.endsWith('.json')) {
				deletePromises.push(fs.unlink(path.join(configDir, file)));
			}
		}
		await Promise.all(deletePromises);
		console.log('[Cleanup] Old bot configs removed successfully.');
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.log('[Cleanup] No old configs found, directory does not exist.');
			return;
		}
		console.error('[Cleanup] Error during old config cleanup:', error);
	}
}

// Initializes and starts the Discord bot client.
export const client = new Client({ intents: [GatewayIntentBits.Guilds] });
async function startDiscordBot() {
	console.log('[Discord] Initializing Discord Bot...');

	client.once(Events.ClientReady, (readyClient) => {
		console.log(`[Discord] Logged in as ${readyClient.user.tag}`);
	});

	client.commands = new Collection();
	const commands = [];

	try {
		await client.login(configurations.DISCORD_TOKEN);
		console.log('[Discord] Discord Bot initialized successfully.');

		const commandsPath = path.join(__dirname, "./bots/discord/commands");
		const commandFiles = (await fs.readdir(commandsPath)).filter(file => file.endsWith(".js"));

		for (const file of commandFiles) {
			const filePath = path.join(commandsPath, file);
			const commandModule = await import(filePath);
			const command = commandModule.default || commandModule;
			if ('data' in command && 'execute' in command) {
				client.commands.set(command.data.name, command);
				commands.push(command.data.toJSON())
			} else {
				console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
			}
		}

		client.on(Events.InteractionCreate, async interaction => {
			if (!interaction.isChatInputCommand()) return;
			const command = interaction.client.commands.get(interaction.commandName);
			if (!command) {
				console.error(`No command matching ${interaction.commandName} was found.`);
				return;
			}

			try {
				await command.execute(interaction);
			} catch (error) {
				console.error(error);
				if (interaction.replied || interaction.deferred) {
					await interaction.followUp({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				} else {
					await interaction.reply({ content: 'There was an error while executing this command!', flags: MessageFlags.Ephemeral });
				}
			}
		});

	} catch (error) {
		console.error('[Discord] Failed to log in to Discord:', error);
	}

	// Register slash commands activate on prod
	try {
		const rest = new REST().setToken(configurations.DISCORD_TOKEN);
		const data = await rest.put(
			Routes.applicationGuildCommands(configurations.DISCORD_CLIENT_ID, configurations.DISCORD_GUILD_ID),
			{ body: commands },
		);

		console.log(`[DISCORD] Loaded ${data.length} application (/) commands.`);
	} catch (error) {
		console.error('[Discord] Failed to Register Slash Commands:', error);
	}
}

// Initializes the keep-alive cron job.
function startKeepAlive() {
	console.log(`[KeepAlive] Scheduling keep-alive pings to ${configurations.apiBaseUrl} every ${configurations.cron.intervalMin} minutes`);
	nodeCron.schedule(`*/${configurations.cron.intervalMin} * * * *`, async () => {
		try {
			await fetch(configurations.apiBaseUrl);
			console.log(chalk.green(`[KeepAlive] Ping successful at ${new Date().toISOString()}`));
		} catch (error) {
			console.error(chalk.yellow(`[KeepAlive] Ping failed at ${new Date().toISOString()}:`, error));
		}
	});
}

// The main application function to set up and run the server.
async function main() {
	await cleanupOldConfigs();
	const app = express();
	app.use(morgan("dev"));
	app.use(express.json());

	app.get("/", (_req, res) => {
		res.json({ message: "Server is active" });
	});
	app.use('/edgerunner', edgeRunnerRoutes);

	try {
		startDiscordBot();
		startKeepAlive();

		app.listen(PORT, () => {
			console.log(`[Server] Server is running on http://localhost:${PORT}`);
		});
	} catch (error) {
		console.error('Failed to start the application:', error);
		process.exit(1);
	}
}

// Handle shutdown signals
async function shutdown(signal) {
	console.log(`Received ${signal}. Shutting down...`);
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(async (error) => {
	console.error('Failed to start the application:', error);
	process.exit(1);
});

