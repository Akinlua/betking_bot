import express from "express";
import morgan from "morgan";
import "dotenv/config.js";
import { 
	Client,
	Events,
	Collection,
	GatewayIntentBits,
	MessageFlags 
} from "discord.js";
import configurations from "../configurations/index.js";
import providerRoutes from "./routes/provider.routes.js";
import bookmakerRoutes from "./routes/bookmaker.routes.js";
import { initializeBrowser, closeBrowser } from './core/browser.js';
import { startPolling } from "./services/provider.service.js";
import chalk from "chalk";
import nodeCron from "node-cron";

const PORT = process.env.PORT || 8080;

// Initializes and starts the Discord bot client.
async function startDiscordBot() {
	console.log('[Discord] Initializing Discord Bot...');
	const client = new Client({ intents: [GatewayIntentBits.Guilds] }); 

	client.once(Events.ClientReady, (readyClient) => {
		console.log(`[Discord] Logged in as ${readyClient.user.tag}`);
	});

	client.commands = new Collection();
	try {
		await client.login(configurations.DISCORD_TOKEN);
		console.log('[Discord] Discord Bot initialized successfully.');
	} catch (error) {
		console.error('[Discord] Failed to log in to Discord:', error);
	}
}

// Initializes and starts the background EdgeRunner bot processes.
async function startEdgeRunnerBot() {
	try {
		await initializeBrowser();
		if (configurations.provider.userId) {
			startPolling();
		} else {
			console.log("[Bot] User ID is missing, polling will not start.");
		}
		console.log(chalk.green(`[Bot] -> EdgeRunner Initialized [INTERVAL-${configurations.bookmaker.interval}]`));
	} catch (error) {
		console.error('[Bot] EdgeRunner Failed:', error);
		process.exit(1);
	}
}

function startKeepAlive() {
  console.log(`[KeepAlive] Scheduling keep-alive pings to ${configurations.apiBaseUrl} every ${configurations.cron.intervalMin} minutes`);
  nodeCron.schedule(`*/${configurations.cron.intervalMin} * * * *`, async () => {
    try {
      const response = await fetch(configurations.apiBaseUrl);
      const data = await response.json();
      console.log(chalk.green(`[KeepAlive] Ping successful at ${new Date().toISOString()}: ${JSON.stringify(data)}`));
    } catch (error) {
      console.error(`[KeepAlive] Ping failed at ${new Date().toISOString()}:`, error.message);
    }
  });
}

// The main application function to set up and run the server.
async function main() {
	const app = express();
	app.use(morgan("dev"));
	app.use(express.json());

	app.get("/", (_req, res) => {
		res.json({ message: "Server is active" });
	});
	app.use('/provider', providerRoutes);
	app.use('/bookmaker', bookmakerRoutes);

	app.listen(PORT, () => {
		console.log(`[Server] Server is running on http://localhost:${PORT}`);
		// startDiscordBot();
		startEdgeRunnerBot();
		startKeepAlive();
	});
}

main().catch(async (error) => {
	console.error('Failed to start the application:', error);
	await closeBrowser();
	process.exit(1);
});

async function shutdown(signal) {
	console.log(`Received ${signal}. Closing browser and shutting down...`);
	await closeBrowser();
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

