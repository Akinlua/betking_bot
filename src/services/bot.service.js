import fs from 'fs/promises';
import path from 'path';
import { getBetKingMatchDataByTeamPair, getBetKingMatchDetailsByEvent } from './bookmaker.service.js';

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
        console.log(`[Bot Service] Loaded ${processedEventIds.size} previously processed event IDs.`);
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('[Bot Service] No processed IDs file found. Starting with a fresh set.');
        } else {
            console.error('[Bot Service] Error loading processed IDs file:', error);
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
        console.error('[Bot Service] Error saving processed IDs file:', error);
    }
}

/**
 * Saves a successfully found match and its original alert data to a JSON file.
 */
async function saveSuccessfulMatch(matchData, alertData) {
    try {
        let existingData = [];
        try {
            const fileContent = await fs.readFile(CORRELATED_DUMP_PATH, 'utf-8');
            existingData = JSON.parse(fileContent);
        } catch (readError) { /* File doesn't exist yet, which is fine. */ }
        
        const comprehensiveData = { providerAlert: alertData, bookmakerMatch: matchData };
        existingData.push(comprehensiveData);
        await fs.writeFile(CORRELATED_DUMP_PATH, JSON.stringify(existingData, null, 2));
        console.log(`[Bot Service]   => Success! Saved correlated match ${matchData.EventName} to file.`);
    } catch (error) {
        console.error('[Bot Service] Error saving successful match to dump file:', error);
    }
}

/**
 * The worker function that processes the queue one job at a time.
 */
async function processQueue() {
    if (isWorkerRunning) return;
    isWorkerRunning = true;
    console.log(`[Bot Service] Worker started. Jobs in queue: ${gameQueue.length}`);

    while (gameQueue.length > 0) {
        const alert = gameQueue.shift();
        try {
            console.log(`[Bot Service] Processing Alert ID: ${alert.id} for game: ${alert.home} vs ${alert.away}`);
            
            // --- STEP 1: Find the preliminary match to get its ID and Name ---
            const preliminaryMatch = await getBetKingMatchDataByTeamPair(alert.home, alert.away);

            if (preliminaryMatch && preliminaryMatch.IDEvent) {
                console.log(`[Bot Service]   => Found preliminary match. Fetching all markets with ID: ${preliminaryMatch.IDEvent}`);
                
                // --- STEP 2: Use the ID and Name to get the complete match data with ALL markets ---
                const detailedMatchData = await getBetKingMatchDetailsByEvent(
                    preliminaryMatch.IDEvent,
                    preliminaryMatch.EventName
                );

                if (detailedMatchData) {
                    // We now have the complete data with all betting markets
                    console.log(`[Bot Service]   => Successfully fetched full data for ${detailedMatchData.EventName}`);
                    // Now, we save the DETAILED data, not the preliminary data
                    await saveSuccessfulMatch(detailedMatchData, alert);
                    // TODO: This is where you would call an 'evaluateOpportunity' function
                    // that would loop through detailedMatchData.Markets
                } else {
                    console.log(`[Bot Service]   => Failed to fetch full match details.`);
                }

            } else {
                console.log(`[Bot Service]   => No match found on BetKing.`);
            }

            const delaySeconds = 5;
            await new Promise(resolve => setTimeout(resolve, delaySeconds * 1000));
        } catch (error) {
            console.error(`[Bot Service] Error processing alert ${alert.id}:`, error);
        }
    }
    isWorkerRunning = false;
    console.log('[Bot Service] Queue is empty. Worker is now idle.');
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
        console.log('[Bot Service] No new, unprocessed games to add to the queue (all were duplicates).');
        return;
    }

    // Add the new, unique IDEvents to our tracking set and save to file.
    newGames.forEach(game => processedEventIds.add(game.IDEvent));
    saveProcessedIds(); // Persist the new set of IDs
    
	console.log(`[Bot Service] Adding ${newGames.length} new games to the processing queue.`);

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
