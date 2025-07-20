import fs from 'fs/promises';
import path from 'path';
import {
	getBetKingMatchDataByTeamPair,
	getBetKingMatchDetailsByEvent
} from './bookmaker.service.js';

const CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data', 'correlated_matches.json');
const PROCESSED_IDS_PATH = path.join(process.cwd(), 'data', 'processed_event_ids.json');

const gameQueue = [];
let isWorkerRunning = false;
let processedEventIds = new Set();

/**
 * Loads previously processed event IDs from a file on startup.
 */
async function loadProcessedIds() {
	try {
		const data = await fs.readFile(PROCESSED_IDS_PATH, 'utf-8');
		const ids = JSON.parse(data);
		processedEventIds = new Set(ids);
		console.log(`[Bot] Loaded ${processedEventIds.size} previously processed event IDs.`);
	} catch (error) {
		if (error.code === 'ENOENT') {
			console.log('[Bot] No processed IDs file found. Starting with a fresh set.');
		} else {
			console.error('[Bot] Error loading processed IDs file:', error);
		}
	}
}

/**
 * Saves the updated set of processed IDs back to the file for persistence.
 */
async function saveProcessedIds() {
	try {
		await fs.writeFile(PROCESSED_IDS_PATH, JSON.stringify(Array.from(processedEventIds), null, 2));
	} catch (error) {
		console.error('[Bot] Error saving processed IDs file:', error);
	}
}

/**
 * Saves a successfully found match and its original provider data to a JSON file.
 */
async function saveSuccessfulMatch(matchData, providerData) {
	try {
		let existingData = [];
		try {
			const fileContent = await fs.readFile(CORRELATED_DUMP_PATH, 'utf-8');
			existingData = JSON.parse(fileContent);
		} catch (readError) { /* File doesn't exist yet, which is fine. */ }

		const comprehensiveData = { providerData: providerData, bookmakerMatch: matchData };
		existingData.push(comprehensiveData);
		await fs.writeFile(CORRELATED_DUMP_PATH, JSON.stringify(existingData, null, 2));
		console.log(`[Bot]   => Success! Saved correlated match ${matchData.EventName} to file.`);

	} catch (error) {
		console.error('[Bot] Error saving successful match to dump file:', error);
	}
}

/**
 * Evaluates betting opportunities by comparing provider data with bookmaker match data.
 */
export async function evaluateBettingOpportunity(matchData, providerData) {
	try {
		console.log("Processing to place bet");
		const lineTypeMapper = {
			"money_line": {
				name: "1x2",
				outcome: {
					"home": "1",
					"draw": "x",
					"away": "2"
				}
			}
			// Add other line types as needed, e.g., "spread": { name: "handicap", outcome: {...} }
		};

		// Get the market name (e.g., "1x2") from the mapper
		const providerLineType = lineTypeMapper[providerData.lineType]?.name;
		if (!providerLineType) {
			console.error(`[Bot] Unknown line type: ${providerData.lineType}`);
			return;
		}

		// Map the provider outcome (e.g., "home" -> "1")
		const outcomeMap = lineTypeMapper[providerData.lineType].outcome;
		const providerOutcomeKey = providerData.outcome.toLowerCase();

		const providerOutcome = outcomeMap[providerOutcomeKey];
		if (!providerOutcome) {
			console.error(`[Bot] Unknown outcome: ${providerData.outcome} for line type ${providerData.lineType}`);
			return;
		}

		// Get the odds from providerData (e.g., "priceHome" for "home")
		const providerOutcomeName = `price${providerOutcomeKey.charAt(0).toUpperCase() + providerOutcomeKey.slice(1)}`;
		const providerOutcomeOdds = providerData[providerOutcomeName];
		if (!providerOutcomeOdds) {
			console.error(`[Bot] Odds not found for outcome ${providerOutcomeKey}`);
			return;
		}

		// console.log("Provider line type:", providerLineType);
		// console.log("Provider Outcome:", providerOutcome);
		// console.log("Provider Outcome odds:", providerOutcomeOdds);

		// get all possible markets from bookmaker
		const markets = matchData.markets;

		markets.forEach((market) => {
			if (market.name.toLowerCase() === providerLineType.toLowerCase()) {
				market.selections.forEach((selection) => {
					if (selection.name.toLowerCase() == providerOutcome.toLowerCase() && selection.status.toUpperCase() === "VALID") {
						const selectionOdds = selection.odd.value;
						const value = ((selectionOdds / providerOutcomeOdds) - 1) * 100;
						if (value > 0) {
							console.log(`[BOT] Value bet: ${value.toFixed(2)}% for ${matchData.name} selection ${selection.name}`);
						} else {
							console.log(`[BOT] Not a value bet: ${value.toFixed(2)}% for ${matchData.name} selection ${selection.name}`);
						}
					} else {
						// console.log(`[BOT] Selection status is invalid or outcome doesn't match`);
					}
				});
			}
		});
	} catch (error) {
		console.error('[Bot] Error evaluating betting opportunity:', error);
	}
}

/**
 * The worker function that processes the queue one job at a time.
 */
async function processQueue() {
	if (isWorkerRunning) return;
	isWorkerRunning = true;
	console.log(`[Bot] Worker started. Jobs in queue: ${gameQueue.length}`);

	while (gameQueue.length > 0) {
		const providerData = gameQueue.shift();
		try {
			console.log(`[Bot] Processing Provider Data ID: ${providerData.id} Game: ${providerData.home} vs ${providerData.away}`);

			// --- STEP 1: Find the preliminary match to get its ID and Name ---
			const preliminaryMatch = await getBetKingMatchDataByTeamPair(providerData.home, providerData.away);

			if (preliminaryMatch && preliminaryMatch.IDEvent) {
				console.log(`[Bot] Found match ${preliminaryMatch}`);

				// --- STEP 2: Use the ID and Name to get the complete match data with ALL markets ---
				const detailedMatchData = await getBetKingMatchDetailsByEvent(
					preliminaryMatch.IDEvent,
					preliminaryMatch.EventName
				);

				if (detailedMatchData) {
					// We now have the complete data with all betting markets
					console.log(`[Bot] Successfully fetched full data for ${detailedMatchData.name}`);
					await saveSuccessfulMatch(detailedMatchData, providerData);
					await evaluateBettingOpportunity(detailedMatchData, providerData);

				} else {
					console.log(`[Bot] Failed to fetch full match details.`);
				}

			} else {
				console.log(`[Bot] Match not found for ${providerData.home} vs ${providerData.away}`);
			}

			const delaySeconds = 5;
			await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
		} catch (error) {
			console.error(`[Bot] Error processing provider data ${providerData.id}:`, error);
		}
	}
	isWorkerRunning = false;
	console.log('[Bot] Queue is empty. Worker is now idle.');
}

/**
 * Adds a list of games to the processing queue after filtering out duplicates by IDEvent.
 */
export function addGamesToProcessingQueue(games) {
	if (!games || !games.length === 0) return;

	// De-duplicate using the IDEvent field against our persistent set.
	// const newGames = games.filter(game => !processedEventIds.has(game.IDEvent));
	const newGames = games;

	if (newGames.length === 0) {
		console.log('[Bot] No new, unprocessed games to add to the queue (all were duplicates).');
		return;
	}

	// Add the new, unique IDEvents to our tracking set and save to file.
	newGames.forEach(game => processedEventIds.add(game.IDEvent));
	saveProcessedIds(); // Persist the new set of IDs

	console.log(`[Bot] Adding ${newGames.length} new games to the processing queue.`);

	// Add debugging index to each new game object before queuing.
	const gamesWithContext = newGames.map((game, index) => ({
		...game,
		debug_index: index,
		debug_total: newGames.length,
	}));

	gameQueue.push(...gamesWithContext);

	processQueue();
}

// Immediately load the processed IDs when the service starts.
loadProcessedIds();
