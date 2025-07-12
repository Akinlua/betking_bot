import express from "express";
import morgan from "morgan";
import "dotenv/config.js";
import fs from 'fs/promises';
import path from 'path';


import configurations from "../configurations/index.js";
// UPDATED: Renamed botRoutes to providerRoutes for clarity
import providerRoutes from "./routes/provider.routes.js";
import { startPolling } from "./services/provider.service.js";

import bookmakerRoutes from "./routes/bookmaker.routes.js";
import { initializeBrowser, closeBrowser } from './core/browser.js';

const PORT = process.env.PORT || 8080;

// --- Main application logic is now inside a self-invoking async function ---
(async () => {
	try {
		// 1. Initialize the shared browser BEFORE starting the server
		// --- NEW: Ensure the data directory exists ---
		const dataDir = path.join(process.cwd(), 'data');
		try {
			await fs.mkdir(dataDir);
			console.log(`Created data directory at ${dataDir}`);
		} catch (error) {
			if (error.code !== 'EEXIST') throw error; // Ignore error if directory already exists
		}
		// --- END OF NEW CODE ---
		await initializeBrowser();

		const app = express();

		app.use(morgan("dev"));
		app.use(express.json());

		app.get("/", (_req, res) => {
			res.json({ message: "Server is active" });
		});

		// UPDATED: Using the new providerRoutes
		app.use('/provider', providerRoutes);
		app.use('/bookmaker', bookmakerRoutes);

		// 2. Start the Express server
		app.listen(PORT, () => {
			console.log(`Server is running on http://localhost:${PORT}`);
			// Polling logic starts here, as you designed.
			configurations.USER_ID ? startPolling() : console.log("User id is missing.");
		});

	} catch (error) {
		console.error('Failed to start the application:', error);
		await closeBrowser();
		process.exit(1);
	}
})();

async function shutdown(signal) {
	console.log(`Received ${signal}. Closing browser and shutting down...`);
	await closeBrowser();
	process.exit(0);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
