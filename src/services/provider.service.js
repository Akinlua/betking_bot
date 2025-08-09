import fs from 'fs/promises';
import path from 'path';
import configurations from "../../configurations/index.js";
import chalk from 'chalk';
import { addGamesToProcessingQueue } from './bot.service.js';

const DUMP_FILE_PATH = path.join(process.cwd(), 'data', 'provider_dump.json');

const botState = {
	isRunning: false,
	statusMessage: "Idle",
	cursor: null,
	lastChecked: null,
	alertsFound: 0
};

export function startPolling() {
	if (botState.isRunning) {
		console.log("[Provider Service] Polling is already running.");
		return;
	}
	if (!configurations.provider.userId) {
		console.error("[Provider Service] -> User Id not set. Polling cannot start.");
		return;
	}
	botState.isRunning = true;
	console.log(chalk.green(`[Provider] -> Polling Started [INTERVAL-${configurations.provider.interval}]`));
	console.log(chalk.cyan(`[Provider] -> ${configurations.provider.userId}`));
	poll();
}

async function poll() {
	while (botState.isRunning) {
		try {
			const url = new URL(configurations.provider.alertApiUrl);
			if (botState.cursor) {
				url.searchParams.set("dropNotificationsCursor", botState.cursor);
			}

			const response = await fetch(url.toString(), { timeout: 60000 });
			if (!response.ok) {
				throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
			}

			const data = await response.json();
			const notifications = data.data;

			if (notifications && notifications.length > 0) {
				const lastAlert = notifications[notifications.length - 1];
				botState.cursor = lastAlert.id;
				botState.alertsFound += notifications.length;
				botState.statusMessage = `SUCCESS: Received ${notifications.length} new alerts.`;

				if (configurations.provider.storeData) {
					try {
						const dir = path.dirname(DUMP_FILE_PATH);
						await fs.mkdir(dir, { recursive: true });
						await fs.writeFile(DUMP_FILE_PATH, JSON.stringify(notifications, null, 2));
						console.log(`[Provider Service] Successfully dumped ${notifications.length} alerts to ${DUMP_FILE_PATH}`);
					} catch (writeError) {
						console.error('[Provider] Error writing data to dump file:', writeError);
					}
				}

				addGamesToProcessingQueue(notifications);

			} else {
				botState.statusMessage = "STATUS: No new notifications.";
			}

		} catch (error) {
			botState.statusMessage = `ERROR: ${error.message}`;
			console.error("[Provider Service] Polling error:", error);
		} finally {
			botState.lastChecked = new Date().toISOString();
			console.log(`[Provider] ${botState.statusMessage} | Cursor: ${botState.cursor}`);
		}

		await new Promise(resolve => setTimeout(resolve, configurations.provider.interval * 1000));
	}
}

export function devigOdds(providerData) {
	const {
		lineType,
		priceHome,
		priceAway,
		priceDraw,
		priceOver,
		priceUnder,
	} = providerData;

	// Helper to parse and validate odds
	const parseOdd = (odd, fieldName) => {
		const parsed = parseFloat(odd);
		if (isNaN(parsed) || parsed <= 1) {
			throw new Error(`Invalid odd for ${fieldName}: ${odd}`);
		}
		return parsed;
	};

	try {
		let odds = [];
		let outcomeKeys = [];

		// Gather odds and define outcomes based on line type
		if (lineType === 'money_line') {
			if (!priceHome || !priceAway || !priceDraw) {
				throw new Error('Missing prices for money_line');
			}
			odds = [
				parseOdd(priceHome, 'priceHome'),
				parseOdd(priceAway, 'priceAway'),
				parseOdd(priceDraw, 'priceDraw'),
			];
			outcomeKeys = ['home', 'away', 'draw'];
		} else if (lineType === 'total') {
			if (!priceOver || !priceUnder) {
				throw new Error('Missing prices for total');
			}
			odds = [
				parseOdd(priceOver, 'priceOver'),
				parseOdd(priceUnder, 'priceUnder'),
			];
			outcomeKeys = ['over', 'under'];
		} else if (lineType === 'spread') {
			if (!priceHome || !priceAway) {
				throw new Error('Missing prices for spread');
			}
			odds = [
				parseOdd(priceHome, 'priceHome'),
				parseOdd(priceAway, 'priceAway'),
			];
			outcomeKeys = ['home', 'away'];
		} else {
			throw new Error(`Unsupported line type: ${lineType}`);
		}

		// Calculate implied probabilities and total
		const impliedProbs = odds.map((odd) => 1 / odd);
		const totalProb = impliedProbs.reduce((sum, p) => sum + p, 0);

		if (totalProb <= 0) {
			throw new Error('Total probability is not positive');
		}

		// Calculate true odds with rounding for consistency
		const trueOdds = {};
		outcomeKeys.forEach((key, i) => {
			trueOdds[key] = Number((1 / (impliedProbs[i] / totalProb)).toFixed(2));
		});

		return trueOdds;
	} catch (error) {
		console.error('[PROVIDER] Error during devigging calculation:', error.message);
		return null;
	}
}

export function getPollingStatus() {
	return botState;
}
