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
import configurations from "./configurations/index.js";
import edgeRunnerRoutes from "./routes/edgerunner.js";
import EdgeRunner from "./bots/edgerunner/index.js";
import chalk from "chalk";
import nodeCron from "node-cron";

const PORT = configurations.PORT || 9090;

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

// Initializes and starts the EdgeRunner bot process.
async function startEdgeRunnerBot() {
  try {
    const bot = new EdgeRunner(configurations);
    bot.start();
    console.log(chalk.green(`[Server] -> EdgeRunner Initialized [INTERVAL-${configurations.bookmaker.interval}]`));
    return bot; // Return bot instance for shutdown
  } catch (error) {
    console.error('[Server] EdgeRunner Failed:', error);
    throw error;
  }
}

// Initializes the keep-alive cron job.
function startKeepAlive() {
  console.log(`[KeepAlive] Scheduling keep-alive pings to ${configurations.apiBaseUrl} every ${configurations.cron.intervalMin} minutes`);
  nodeCron.schedule(`*/${configurations.cron.intervalMin} * * * *`, async () => {
    try {
      await fetch(configurations.apiBaseUrl);
      // const data = await response.json();
      console.log(chalk.green(`[KeepAlive] Ping successful at ${new Date().toISOString()}`));
    } catch (error) {
      console.error(chalk.yellow(`[KeepAlive] Ping failed at ${new Date().toISOString()}:`, error));
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
  app.use('/edgerunner', edgeRunnerRoutes);

  let bot;
  try {
    bot = await startEdgeRunnerBot();
	global.bot = bot; // Store bot instance for other parts to access
    // startDiscordBot(); // Commented out as in original
    startKeepAlive();

    app.listen(PORT, () => {
      console.log(`[Server] Server is running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start the application:', error);
    if (bot) bot.stop();
    process.exit(1);
  }
}

// Handle shutdown signals
async function shutdown(signal) {
  console.log(`Received ${signal}. Closing browser and shutting down...`);
  if (global.bot) {
    await global.bot.stop();
  }
  process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

main().catch(async (error) => {
  console.error('Failed to start the application:', error);
  if (global.bot) await global.bot.stop();
  process.exit(1);
});
