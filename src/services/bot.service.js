import fs from 'fs/promises';
import path from 'path';
import { getBookmakerIntegration } from './bookmakers/index.js';
import { devigOdds } from './provider.service.js';
import chalk from 'chalk';
import { AuthenticationError } from '../core/errors.js';
import configurations from '../../configurations/index.js';

const gameQueue = [];
let isWorkerRunning = false;
const CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data', 'correlated_matches.json');

async function saveSuccessfulMatch(matchData, providerData) {
	if (configurations.bookmaker.storeData) {
		try {
			// Ensure the data/ directory exists
			const dir = path.dirname(CORRELATED_DUMP_PATH);
			await fs.mkdir(dir, { recursive: true });
			const comprehensiveData = { providerData: providerData, bookmakerMatch: matchData };

			// Overwrite file with new data
			await fs.writeFile(CORRELATED_DUMP_PATH, JSON.stringify(comprehensiveData, null, 2));
			console.log(`[Bot] Success: Overwrote ${CORRELATED_DUMP_PATH}`);
		} catch (error) {
			console.error(`[Bot] Error writing to ${CORRELATED_DUMP_PATH}:`, error.message);
		}
	}
}

export function calculateStake(trueOdd, bookmakerOdds, bankroll, fraction = 0.1) {
	// 1. Calculate the "true" probability from the no-vig odds
	const trueProbability = 1 / trueOdd;

	// 2. Calculate the Kelly fraction
	const b = bookmakerOdds - 1;
	const q = 1 - trueProbability;
	const numerator = (b * trueProbability) - q;

	if (numerator <= 0) {
		return 0; // No value, do not bet.
	}

	const fullStake = bankroll * (numerator / b);

	// 3. Return the fractional Kelly stake and round to 2 decimal places
	const finalStake = Math.floor((fullStake * fraction) * 100) / 100;

	return finalStake;
}

export async function evaluateBettingOpportunity(matchData, providerData, bookmaker) {
	try {
		// used to make uni test easier comment later
		// const bookmaker = getBookmakerIntegration('betking');

		const translatedData = bookmaker.translateProviderData(providerData);

		if (!translatedData) {
			console.log(`[Bot] Could not translate provider data for ${providerData.lineType}`);
			return null;
		}

		console.log(chalk.yellow("translated data", JSON.stringify(translatedData)));

		const calculateValue = (selection, providerData) => {
			const outcomeKey = providerData.outcome.toLowerCase();
			const trueOdd = devigOdds(providerData)?.[outcomeKey];

			const fallbackOddsKey = `price${outcomeKey.charAt(0).toUpperCase() + outcomeKey.slice(1)}`;
			const originalOdd = parseFloat(providerData[fallbackOddsKey]);
			const oddsToUse = trueOdd || originalOdd;

			if (!oddsToUse || isNaN(oddsToUse)) {
				console.error(`[Bot] Could not find valid odds for outcome: ${outcomeKey}`);
				return null;
			}

			console.log(chalk.cyan(`Using odds: ${oddsToUse.toFixed(2)} (${trueOdd ? 'No-Vig' : 'Original'})`));

			const value = (selection.odd.value / oddsToUse - 1) * 100;

			return {
				value: value,
				trueOdd: oddsToUse,
				bookmakerOdds: selection.odd.value
			};
		};

		// Loop through the bookmaker's markets to find a match
		for (const market of matchData.markets) {
			const marketNameLower = market.name.toLowerCase();
			const translatedMarketNameLower = translatedData.marketName.toLowerCase();

			// --- Case 1: Money Line (1x2) ---
			if (providerData.lineType === 'money_line') {
				if (marketNameLower.startsWith(translatedMarketNameLower)) {
					for (const selection of market.selections) {
						if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
							const result = calculateValue(selection, providerData);
							if (result && result.value > 0) {
								console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
								return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
							}
							else if (result) {
								console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
							}
						}
					}
				}
			}

			else if (providerData.lineType === 'total') {
				if (marketNameLower.startsWith(translatedMarketNameLower.replace(/ \d+(\.\d+)?$/, ''))) {
					const marketPoints = parseFloat(market.specialValue);
					const providerPoints = parseFloat(translatedData.specialValue);
					let pointsToCheck = [providerPoints];
					if (Number.isInteger(providerPoints)) {
						pointsToCheck.push(providerPoints + 0.5); // Try half-point for round numbers
					}
					console.log(`[BOT] Checking total market: ${market.name}, specialValue: ${market.specialValue}, translatedSpecialValue: ${providerPoints}`);
					for (const checkPoints of pointsToCheck) {
						console.log(`[BOT] Checking points: marketPoints=${marketPoints}, checkPoints=${checkPoints}`);
						if (marketPoints === checkPoints) {
							for (const selection of market.selections) {
								console.log(`[BOT] Checking selection: ${selection.name}, status: ${selection.status}`);
								if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
									const result = calculateValue(selection, providerData);
									// if (result && result.value > 0) {
										console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
										return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
									// }
									// else if (result) {
									// 	console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
									// }
								}
							}
						}
					}
				} else {
					console.log(`[BOT] Market name mismatch: marketName=${market.name}, translatedMarketName=${translatedMarketNameLower}`);
				}
			}

			// --- Case 3: Spreads (Handicap) ---
			else if (providerData.lineType === 'spread') {
				if (marketNameLower.startsWith(translatedMarketNameLower)) {
					if (translatedData.specialValue.replace(/\s/g, '') === market.specialValue.replace(/\s/g, '')) {
						for (const selection of market.selections) {
							if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
								const result = calculateValue(selection, providerData);
								// if (result && result.value > 0) {
								console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
								return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
								// }
								// else if (result) {
								// 	console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
								// }
							}
						}
					} else {
						console.log(`[BOT] Special value mismatch: Provider=${translatedData.specialValue}, Bookmaker=${market.specialValue}`);
					}
				}
			}
		}

		// If the loop finishes without finding a value bet
		console.log(`[BOT] No value bet found for ${matchData.name}.`);
		return null;

	} catch (error) {
		console.error('[Bot] Error evaluating betting opportunity:', error);
		return null;
	}
}

async function processQueue() {
	if (isWorkerRunning) return;
	isWorkerRunning = true;

	const bookmaker = getBookmakerIntegration('betking');

	let bankroll;
	try {
		console.log('[Bot] Fetching initial account info...');
		const accountInfo = await bookmaker.getAccountInfo("07033054766");
		bankroll = accountInfo.balance;
	} catch (error) {
		if (error instanceof AuthenticationError) {
			console.log(chalk.yellow(`[Bot] Auth error: ${error.message}. Attempting to sign in...`));

			// Hardcode credentials for now as requested
			const signInResult = await bookmaker.signin("07033054766", "A1N2S3I4");

			if (signInResult.success) {
				const accountInfo = await bookmaker.getAccountInfo("07033054766");
				if (accountInfo) {
					bankroll = accountInfo.balance;
				}
			}
		} else {
			console.error('[Bot] An unexpected error occurred while fetching account info:', error);
		}
	}

	if (bankroll === undefined) {
		console.error(chalk.red('[Bot] Could not establish bankroll. Worker stopping.'));
		isWorkerRunning = false;
		return;
	}
	console.log(chalk.green(`[Bot] Worker started. Initial bankroll: ${bankroll}.`));

	while (gameQueue.length > 0) {
		const providerData = gameQueue.pop(); // Using shift for FIFO
		try {
			console.log(`[Bot] Processing: ${providerData.home} vs ${providerData.away}`);

			// --- STEP 1: Find a potential match ---
			const potentialMatch = await bookmaker.getMatchDataByTeamPair(providerData.home, providerData.away);
			if (!potentialMatch) {
				console.log(`[Bot] Match not found for ${providerData.home} vs ${providerData.away}`);
				continue; // Exit for this item
			}
			console.log(`[Bot] Found potential match: ${potentialMatch.EventName}`);

			// --- STEP 2: Get full match details ---
			const detailedMatchData = await bookmaker.getMatchDetailsByEvent(
				potentialMatch.IDEvent,
				potentialMatch.EventName
			);
			if (!detailedMatchData) {
				console.log(`[Bot] Failed to fetch full match details.`);
				continue; // Exit for this item
			}
			console.log(`[Bot] Successfully fetched full data for ${detailedMatchData.name}`);

			// --- STEP 3: Verify the match time ---
			const isMatchVerified = await bookmaker.verifyMatch(detailedMatchData, providerData);
			if (!isMatchVerified) {
				console.log(`[Bot] Match discarded due to time mismatch: ${detailedMatchData.name}`)
				continue; // Exit for this item
			}
			console.log('[Bot] Match time verified successfully.', detailedMatchData.name);

			await saveSuccessfulMatch(detailedMatchData, providerData);

			// --- STEP 4: Evaluate for a value bet ---
			const valueBetDetails = await evaluateBettingOpportunity(detailedMatchData, providerData, bookmaker);
			if (!valueBetDetails) {
				continue; // Exit for this item
			}

			// --- FINAL STEP: Calculate stake and place the bet ---
			// const stakeAmount = calculateStake(
			// 	valueBetDetails.trueOdd,
			// 	valueBetDetails.bookmakerOdds,
			// 	bankroll
			// );
			const stakeAmount = 10;
			if (stakeAmount > 0) {
				const summary = {
					match: detailedMatchData.name,
					market: valueBetDetails.market.name,
					selection: valueBetDetails.selection.name,
					odds: valueBetDetails.selection.odd.value,
					stake: stakeAmount,
					potentialWinnings: stakeAmount * valueBetDetails.selection.odd.value,
					bankroll: bankroll
				};
				console.log(chalk.greenBright('[Bot] Constructed Bet:'), summary);

				try {
					const betPayload = bookmaker.constructBetPayload(
						detailedMatchData,
						valueBetDetails.market,
						valueBetDetails.selection,
						stakeAmount,
						providerData
					);
					await bookmaker.placeBet("07033054766", betPayload);
					console.log('[Bot] Bet placed, fetching updated account info...');
					const updatedAccountInfo = await bookmaker.getAccountInfo("07033054766");
					if (updatedAccountInfo) {
						bankroll = updatedAccountInfo.balance; // Re-assign the new balance
						console.log(chalk.cyan(`[Bot] Bankroll updated to: ${bankroll}`));
					}
				} catch (betError) {
					if (betError instanceof AuthenticationError) {
						console.log(chalk.yellow(`[Bot] Auth error during bet placement: ${betError.message}. Re-signing in...`));
						const signInResult = await bookmaker.signin("07033054766", "A1N2S3I4");
						if (signInResult.success) {
							console.log('[Bot] Sign-in successful. Retrying bet placement...');
							// Retry placing the bet once
							await bookmaker.placeBet("07033054766", betPayload);
						}
					} else {
						throw betError; // Re-throw other betting errors
					}
				}

			} else {
				console.log('[Bot] No value according to Kelly Criterion, skipping bet.');
			}

		} catch (error) {
			console.error(`[Bot] Error processing provider data ${providerData.id}:`, error);
		} finally {
			// Add a delay between processing each item
			await new Promise(resolve => setTimeout(resolve, configurations.bookmaker.interval * 1000));
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
	// When pod first starts it drops mostly outdated games in bulk 250 we skip this to save time
	// comment out if we need the test data
	if (!games || games.length === 250) {
		console.log("[Bot] skipping the bulk 250");
		return
	};

	const newGames = games;

	if (newGames.length === 0) {
		console.log('[Bot] No new, unprocessed games to add to the queue (all were duplicates).');
		return;
	}

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

//
// import fs from 'fs/promises';
// import path from 'path';
// import chalk from 'chalk';
// import { getBookmakerIntegration } from './bookmakers/index.js';
// import { devigOdds } from './provider.service.js';
//
// const CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data', 'correlated_matches.json');
//
// class Bot {
// 	constructor(user) {
// 		this.user = user;
// 		this.bookmaker = getBookmakerIntegration('betking');
// 		this.gameQueue = [];
// 		this.isWorkerRunning = false;
// 		this.bankroll = 0;
// 	}
//
// 	async start() {
// 		console.log(`[Bot] Starting for user: ${this.user.username}`);
// 		const accountInfo = await this.bookmaker.getAccountInfo(this.user.username);
// 		if (!accountInfo) {
// 			console.error(`[Bot] Could not fetch initial info for ${this.user.username}. Stopping.`);
// 			return;
// 		}
// 		this.bankroll = accountInfo.balance;
// 		console.log(`[Bot] Initial bankroll for ${this.user.username}: ${this.bankroll}`);
// 	}
//
// 	addGamesToProcessingQueue(games) {
// 		if (!games || games.length === 0) return;
// 		this.gameQueue.push(...games);
// 		if (!this.isWorkerRunning) {
// 			this.processQueue();
// 		}
// 	}
//
// 	async saveSuccessfulMatch(matchData, providerData) {
// 		try {
// 			let existingData = [];
// 			try {
// 				const fileContent = await fs.readFile(CORRELATED_DUMP_PATH, 'utf-8');
// 				existingData = JSON.parse(fileContent);
// 			} catch (readError) { /* File doesn't exist yet */ }
//
// 			const comprehensiveData = { providerData, bookmakerMatch: matchData };
// 			existingData.push(comprehensiveData);
// 			await fs.writeFile(CORRELATED_DUMP_PATH, JSON.stringify(existingData, null, 2));
// 			console.log(`[Bot] => Success! Saved correlated match ${matchData.EventName} to file.`);
// 		} catch (error) {
// 			console.error('[Bot] Error saving successful match to dump file:', error);
// 		}
// 	}
//
// 	calculateStake(trueOdd, bookmakerOdds, bankroll, fraction = 0.1) {
// 		const trueProbability = 1 / trueOdd;
// 		const b = bookmakerOdds - 1;
// 		const q = 1 - trueProbability;
// 		const numerator = (b * trueProbability) - q;
// 		if (numerator <= 0) return 0;
// 		const fullStake = bankroll * (numerator / b);
// 		return Math.floor((fullStake * fraction) * 100) / 100;
// 	}
//
// 	async evaluateBettingOpportunity(matchData, providerData) {
// 		try {
// 			const translatedData = this.bookmaker.translateProviderData(providerData);
// 			if (!translatedData) {
// 				console.log(`[Bot] Could not translate provider data for ${providerData.lineType}`);
// 				return null;
// 			}
//
// 			const calculateValue = (selection, providerData) => {
// 				const outcomeKey = providerData.outcome.toLowerCase();
// 				const trueOdd = devigOdds(providerData)?.[outcomeKey];
// 				const fallbackOddsKey = `price${outcomeKey.charAt(0).toUpperCase() + outcomeKey.slice(1)}`;
// 				const originalOdd = parseFloat(providerData[fallbackOddsKey]);
// 				const oddsToUse = trueOdd || originalOdd;
// 				if (!oddsToUse || isNaN(oddsToUse)) return null;
// 				const value = (selection.odd.value / oddsToUse - 1) * 100;
// 				return {
// 					value: value,
// 					trueOdd: oddsToUse,
// 					bookmakerOdds: selection.odd.value
// 				};
// 			};
//
// 			for (const market of matchData.markets) {
// 				const marketNameLower = market.name.toLowerCase();
// 				const translatedMarketNameLower = translatedData.marketName.toLowerCase();
//
// 				// --- Case 1: Money Line (1x2) ---
// 				if (providerData.lineType === 'money_line') {
// 					if (marketNameLower.startsWith(translatedMarketNameLower)) {
// 						for (const selection of market.selections) {
// 							if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
// 								const result = calculateValue(selection, providerData);
// 								if (result && result.value > 0) {
// 									console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
// 									return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
// 								}
// 								else if (result) {
// 									console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
// 								}
// 							}
// 						}
// 					}
// 				}
//
// 				else if (providerData.lineType === 'total') {
// 					if (marketNameLower.startsWith(translatedMarketNameLower.replace(/ \d+(\.\d+)?$/, ''))) {
// 						const marketPoints = parseFloat(market.specialValue);
// 						const providerPoints = parseFloat(translatedData.specialValue);
// 						let pointsToCheck = [providerPoints];
// 						if (Number.isInteger(providerPoints)) {
// 							pointsToCheck.push(providerPoints + 0.5); // Try half-point for round numbers
// 						}
// 						console.log(`[BOT] Checking total market: ${market.name}, specialValue: ${market.specialValue}, translatedSpecialValue: ${providerPoints}`);
// 						for (const checkPoints of pointsToCheck) {
// 							console.log(`[BOT] Checking points: marketPoints=${marketPoints}, checkPoints=${checkPoints}`);
// 							if (marketPoints === checkPoints) {
// 								for (const selection of market.selections) {
// 									console.log(`[BOT] Checking selection: ${selection.name}, status: ${selection.status}`);
// 									if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
// 										const result = calculateValue(selection, providerData);
// 										if (result && result.value > 0) {
// 											console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
// 											return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
// 										}
// 										else if (result) {
// 											console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
// 										}
// 									}
// 								}
// 							}
// 						}
// 					} else {
// 						console.log(`[BOT] Market name mismatch: marketName=${market.name}, translatedMarketName=${translatedMarketNameLower}`);
// 					}
// 				}
//
// 				// --- Case 3: Spreads (Handicap) ---
// 				else if (providerData.lineType === 'spread') {
// 					if (marketNameLower.startsWith(translatedMarketNameLower)) {
// 						if (translatedData.specialValue.replace(/\s/g, '') === market.specialValue.replace(/\s/g, '')) {
// 							for (const selection of market.selections) {
// 								if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
// 									const result = calculateValue(selection, providerData);
// 									if (result && result.value > 0) {
// 										console.log(`[BOT] Value bet found: ${result.value.toFixed(2)}%`);
// 										return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
// 									}
// 									else if (result) {
// 										console.log(`[BOT] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
// 									}
// 								}
// 							}
// 						} else {
// 							console.log(`[BOT] Special value mismatch: Provider=${translatedData.specialValue}, Bookmaker=${market.specialValue}`);
// 						}
// 					}
// 				}
// 			}
//
// 			console.log(`[BOT] No value bet found for ${matchData.name}.`);
// 			return null;
// 		} catch (error) {
// 			console.error('[Bot] Error evaluating betting opportunity:', error);
// 			return null;
// 		}
// 	}
//
// 	async processQueue() {
// 		if (this.isWorkerRunning) return;
// 		this.isWorkerRunning = true;
//
// 		while (this.gameQueue.length > 0) {
// 			const providerData = this.gameQueue.shift();
// 			try {
// 				console.log(`[Bot] Processing: ${providerData.home} vs ${providerData.away}`);
//
// 				const potentialMatch = await this.bookmaker.getMatchDataByTeamPair(providerData.home, providerData.away);
// 				if (!potentialMatch) {
// 					console.log(`[Bot] Match not found for ${providerData.home} vs ${providerData.away}`);
// 					continue;
// 				}
//
// 				const detailedMatchData = await this.bookmaker.getMatchDetailsByEvent(potentialMatch.IDEvent, potentialMatch.EventName);
// 				if (!detailedMatchData) {
// 					console.log(`[Bot] Failed to fetch full match details.`);
// 					continue;
// 				}
//
// 				const isMatchVerified = this.bookmaker.verifyMatch(detailedMatchData, providerData);
// 				if (!isMatchVerified) {
// 					console.log(`[Bot] Match discarded due to time mismatch: ${detailedMatchData.name}`);
// 					continue;
// 				}
//
// 				await this.saveSuccessfulMatch(detailedMatchData, providerData);
//
// 				const valueBetDetails = await this.evaluateBettingOpportunity(detailedMatchData, providerData);
// 				if (!valueBetDetails) {
// 					continue;
// 				}
//
// 				const stakeAmount = this.calculateStake(valueBetDetails.trueOdd, valueBetDetails.bookmakerOdds, this.bankroll);
//
// 				if (stakeAmount > 0) {
// 					const summary = {
// 						match: detailedMatchData.name,
// 						market: valueBetDetails.market.name,
// 						selection: valueBetDetails.selection.name,
// 						odds: valueBetDetails.selection.odd.value,
// 						stake: stakeAmount,
// 						potentialWinnings: stakeAmount * valueBetDetails.selection.odd.value,
// 						bankroll: bankroll
// 					};
// 					console.log(chalk.greenBright('[Bot] Constructed Bet:'), summary);
//
// 					const betPayload = bookmaker.constructBetPayload(
// 						detailedMatchData,
// 						valueBetDetails.market,
// 						valueBetDetails.selection,
// 						stakeAmount,
// 						providerData
// 					);
//
// 					await this.bookmaker.placeBet(this.user.username, betPayload);
//
// 					const updatedInfo = await this.bookmaker.getAccountInfo(this.user.username);
// 					if (updatedInfo) {
// 						this.bankroll = updatedInfo.balance;
// 					}
// 				}
// 			} catch (error) {
// 				console.error(`[Bot] Error processing provider data ${providerData.id}:`, error);
// 			}
// 		}
// 		this.isWorkerRunning = false;
// 	}
// }
//
// export default Bot;
