import EdgeRunner from "./index.js";
import fs from "fs/promises";
import chalk from "chalk";

async function main() {
	const configPath = process.env.CONFIG_PATH;
	if (!configPath) {
		console.error('[BotRunner] No CONFIG_PATH provided');
		process.exit(1);
	}

	try {
		const config = JSON.parse(await fs.readFile(configPath, 'utf8'));
		const bot = await EdgeRunner.create(config);
		// const bot = new EdgeRunner(config);
		await bot.start();
		console.log(chalk.green(`[BotRunner] EdgeRunner started with config: ${configPath}`));

		process.on('message', async (msg) => {
			if (msg.type === 'config') {
				bot.edgerunner = { ...bot.edgerunner, ...msg.data.config };
				console.log(chalk.cyan(`[BotRunner] Config updated:`, bot.edgerunner));
			} else if (msg.type === 'stop') {
				await bot.stop();
				console.log('[BotRunner] Stopped');
				process.exit(0);
			} else if (msg.type === 'status') {
				process.send({
					type: 'status',
					data: {
						status: bot.getStatus()
					}
				});
			}
		});
	} catch (error) {
		console.error('[BotRunner] Failed to start bot:', error);
		try {
			await fs.unlink(configPath);
			console.log(chalk.yellow(`[BotRunner] Cleaned up config for failed bot at ${configPath}`));
		} catch (cleanupError) {
			console.error(chalk.red('[BotRunner] Failed to clean up config file:', cleanupError));
		}
		process.exit(1);
	}
}

main();
