import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getBookmakerInterface } from '../../interfaces/bookmakers/index.js';
import { getProviderInterface } from '../../interfaces/providers/index.js';
import chalk from 'chalk';
import { AuthenticationError } from '../../core/errors.js';
import configurations from '../../configurations/index.js';

puppeteer.use(stealthPlugin());

class EdgeRunner {
	#gameQueue = [];
	#seenGameIds = new Set();
	#isWorkerRunning = false;
	#CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data', 'correlated_matches.json');

	constructor(config) {
		this.config = config;
		this.username = config.bookmaker.username;
		this.password = config.bookmaker.password;
		this.provider = getProviderInterface(config.provider.name, config.provider);
		this.edgeRunner = config.edgeRunner;
		this.bankroll = null;
	}

	async initialize() {
		try {
			this.browser = await this.#initializeBrowser();
			this.bookmaker = getBookmakerInterface(this.config.bookmaker.name, this.config.bookmaker, this.browser);
		} catch (error) {
			console.error(chalk.red('[EdgeRunner] Failed to initialize:', error));
			throw error;
		}
	}

	async #initializeBrowser() {
		if (this.browser && this.bookmaker) {
			console.log(chalk.yellow('[EdgeRunner] Already initialized, skipping.'));
			return;
		}
		try {
			const browser = await puppeteer.launch({
				headless: true,
				args: [
					'--no-sandbox',
					'--disable-setuid-sandbox',
					'--no-zygote',
					'--single-process',
					'--disable-extensions',
					'--disable-sync',
					'--disable-translate',
					'--mute-audio',
					'--no-first-run',
					'--disable-gpu',
					'--disable-dev-shm-usage',
					'--disable-http-cache',
					'--disable-background-networking',
					'--disable-features=site-per-process',
					'--disable-accelerated-2d-canvas',
					'--disable-background-timer-throttling',
					'--disable-client-side-phishing-detection'
				],
				protocolTimeout: 60_000
			});
			console.log(chalk.green('[Edgerunner - Browser] -> Browser Initialized for EdgeRunner'));
			return browser;
		} catch (error) {
			console.error(chalk.red('[Edgerunner - Browser] -> Initialization Failed:', error));
			throw error;
		}
	}

	async #saveSuccessfulMatch(matchData, providerData) {
		if (configurations.bookmaker.storeData) {
			try {
				const dir = path.dirname(this.#CORRELATED_DUMP_PATH);
				await fs.mkdir(dir, { recursive: true });
				const comprehensiveData = { providerData, bookmakerMatch: matchData };
				await fs.writeFile(this.#CORRELATED_DUMP_PATH, JSON.stringify(comprehensiveData, null, 2));
				console.log(`[Edgerunner] Successfully Saved Provider-Bookmaker data to correlated file`);
			} catch (error) {
				console.error(`[Edgerunner] Error writing to ${this.#CORRELATED_DUMP_PATH}:`, error.message);
			}
		}
	}

	#calculateStake(trueOdd, bookmakerOdds, bankroll) {
		const trueProbability = 1 / trueOdd;
		const b = bookmakerOdds - 1;
		const q = 1 - trueProbability;
		const numerator = (b * trueProbability) - q;

		if (numerator <= 0) {
			return 0;
		}

		const stakeFraction = this.edgeRunner.stakeFraction || 0.1;
		const fullStake = bankroll * (numerator / b);
		const finalStake = Math.floor((fullStake * stakeFraction) * 100) / 100;

		return finalStake;
	}

	async #evaluateBettingOpportunity(matchData, providerData) {
		try {
			const translatedData = this.bookmaker.translateProviderData(providerData);

			if (!translatedData) {
				console.log(`[Edgerunner] Could not translate provider data for ${providerData.lineType}`);
				return null;
			}

			console.log(chalk.yellow("translated data", JSON.stringify(translatedData)));

			const calculateValue = (selection, providerData) => {
				const outcomeKey = providerData.outcome.toLowerCase();
				const trueOdd = this.provider.devigOdds(providerData)?.[outcomeKey];
				const fallbackOddsKey = `price${outcomeKey.charAt(0).toUpperCase() + outcomeKey.slice(1)}`;
				const originalOdd = parseFloat(providerData[fallbackOddsKey]);
				const oddsToUse = trueOdd || originalOdd;

				if (!oddsToUse || isNaN(oddsToUse)) {
					console.error(`[Edgerunner] Could not find valid odds for outcome: ${outcomeKey}`);
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

			for (const market of matchData.markets) {
				const marketNameLower = market.name.toLowerCase();
				const translatedMarketNameLower = translatedData.marketName.toLowerCase();

				if (providerData.lineType === 'money_line') {
					if (marketNameLower.startsWith(translatedMarketNameLower)) {
						for (const selection of market.selections) {
							if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
								const result = calculateValue(selection, providerData);
								if (result && result.value > this.edgeRunner.minValueBetPercentage) {
									console.log(`[Edgerunner] Value bet found: ${result.value.toFixed(2)}%`);
									return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
								} else if (result) {
									console.log(`[Edgerunner] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
								}
							}
						}
					}
				} else if (providerData.lineType === 'total') {
					if (marketNameLower.startsWith(translatedMarketNameLower.replace(/ \d+(\.\d+)?$/, ''))) {
						const marketPoints = parseFloat(market.specialValue);
						const providerPoints = parseFloat(translatedData.specialValue);
						let pointsToCheck = [providerPoints];
						if (Number.isInteger(providerPoints)) {
							pointsToCheck.push(providerPoints + 0.5);
						}
						console.log(`[Edgerunner] Checking total market: ${market.name}, specialValue: ${market.specialValue}, translatedSpecialValue: ${providerPoints}`);
						for (const checkPoints of pointsToCheck) {
							console.log(`[Edgerunner] Checking points: marketPoints=${marketPoints}, checkPoints=${checkPoints}`);
							if (marketPoints === checkPoints) {
								for (const selection of market.selections) {
									console.log(`[Edgerunner] Checking selection: ${selection.name}, status: ${selection.status}`);
									if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
										const result = calculateValue(selection, providerData);
										if (result && result.value > this.edgeRunner.minValueBetPercentage) {
											console.log(`[Edgerunner] Value bet found: ${result.value.toFixed(2)}%`);
											return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
										} else if (result) {
											console.log(`[Edgerunner] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
										}
									}
								}
							}
						}
					} else {
						console.log(`[Edgerunner] Market name mismatch: marketName=${market.name}, translatedMarketName=${translatedMarketNameLower}`);
					}
				} else if (providerData.lineType === 'spread') {
					if (marketNameLower.startsWith(translatedMarketNameLower)) {
						if (translatedData.specialValue.replace(/\s/g, '') === market.specialValue.replace(/\s/g, '')) {
							for (const selection of market.selections) {
								if (selection.name.toLowerCase() === translatedData.selectionName.toLowerCase() && selection.status.toUpperCase() === "VALID") {
									const result = calculateValue(selection, providerData);
									if (result && result.value > this.edgeRunner.minValueBetPercentage) {
										console.log(`[Edgerunner] Value bet found: ${result.value.toFixed(2)}%`);
										return { market, selection, trueOdd: result.trueOdd, bookmakerOdds: result.bookmakerOdds };
									} else if (result) {
										console.log(`[Edgerunner] No value bet for "${selection.name}": Value=${result.value.toFixed(2)}%`);
									}
								}
							}
						} else {
							console.log(`[Edgerunner] Special value mismatch: Provider=${translatedData.specialValue}, Bookmaker=${market.specialValue}`);
						}
					}
				}
			}

			console.log(`[Edgerunner] No value bet found for ${matchData.name}.`);
			return null;
		} catch (error) {
			console.error('[Edgerunner] Error evaluating betting opportunity:', error);
			return null;
		}
	}

	async #processQueue() {
		if (this.#isWorkerRunning) return;
		this.#isWorkerRunning = true;

		if (this.bankroll === null) {
			try {
				console.log('[Edgerunner] Fetching initial account info');
				if (!this.bookmaker) {
					throw new Error('Bookmaker not initialized');
				}
				const accountInfo = await this.bookmaker.getAccountInfo(this.username);
				if (!accountInfo) {
					throw new Error('Failed to fetch account info');
				}
				this.bankroll = accountInfo.balance;
			} catch (error) {
				if (error instanceof AuthenticationError) {
					console.log(chalk.yellow(`[Edgerunner] Auth error: ${error.message}. Attempting to sign in...`));
					const signInResult = await this.bookmaker.signin(this.username, this.password);
					if (signInResult.success) {
						const accountInfo = await this.bookmaker.getAccountInfo(this.username);
						if (accountInfo) {
							this.bankroll = accountInfo.balance;
						}
					}
				} else {
					console.error('[Edgerunner] An unexpected error occurred while fetching account info:', error);
				}
			}
		}

		if (this.bankroll === null) {
			console.error(chalk.red('[Edgerunner] Could not establish bankroll. Worker stopping.'));
			this.#isWorkerRunning = false;
			return;
		}
		console.log(chalk.green(`[Edgerunner] Worker started. Initial bankroll: ${this.bankroll}.`));

		while (this.#gameQueue.length > 0) {
			const providerData = this.#gameQueue.shift(); // FIFO
			try {
				console.log(`[Edgerunner] Processing: ${providerData.home} vs ${providerData.away}`);

				const potentialMatch = await this.bookmaker.getMatchDataByTeamPair(providerData.home, providerData.away);
				if (!potentialMatch) {
					console.log(`[Edgerunner] Match not found for ${providerData.home} vs ${providerData.away}`);
					continue;
				}
				console.log(`[Edgerunner] Potential Match Found: ${potentialMatch.EventName}`);

				const detailedMatchData = await this.bookmaker.getMatchDetailsByEvent(
					potentialMatch.IDEvent,
					potentialMatch.EventName
				);
				if (!detailedMatchData) {
					console.log(`[Edgerunner] Failed to fetch full match details.`);
					continue;
				}
				// console.log(`[Edgerunner] Successfully fetched full data for ${detailedMatchData.name}`);

				const isMatchVerified = await this.bookmaker.verifyMatch(detailedMatchData, providerData);
				if (!isMatchVerified) {
					console.log(`[Edgerunner] Match Time Mismatch Disacrd: ${detailedMatchData.name}`);
					continue;
				}
				console.log('[Edgerunner] Match Time Verified For:', detailedMatchData.name);

				await this.#saveSuccessfulMatch(detailedMatchData, providerData);

				const valueBetDetails = await this.#evaluateBettingOpportunity(detailedMatchData, providerData);
				if (!valueBetDetails) {
					continue;
				}

				const stakeAmount = this.edgeRunner.fixedStake.enabled
					? this.edgeRunner.fixedStake.value
					: this.#calculateStake(valueBetDetails.trueOdd, valueBetDetails.bookmakerOdds, this.bankroll);

				if (stakeAmount > 0) {
					const summary = {
						match: detailedMatchData.name,
						market: valueBetDetails.market.name,
						selection: valueBetDetails.selection.name,
						odds: valueBetDetails.selection.odd.value,
						stake: stakeAmount,
						potentialWinnings: stakeAmount * valueBetDetails.selection.odd.value,
						bankroll: this.bankroll
					};
					console.log(chalk.greenBright('[Edgerunner] Constructed Bet:'), summary);

					try {
						const betPayload = this.bookmaker.constructBetPayload(
							detailedMatchData,
							valueBetDetails.market,
							valueBetDetails.selection,
							stakeAmount,
							providerData
						);
						await this.bookmaker.placeBet(this.username, betPayload);
						console.log(chalk.bold.magenta('[Edgerunner] Bet placed'));
						// console.log('[Edgerunner] Update Account Info');
						const updatedAccountInfo = await this.bookmaker.getAccountInfo(this.username);
						if (updatedAccountInfo) {
							this.bankroll = updatedAccountInfo.balance;
							console.log(chalk.cyan(`[Edgerunner] Bankroll updated to: ${this.bankroll}`));
						}
					} catch (betError) {
						if (betError instanceof AuthenticationError) {
							console.log(chalk.yellow(`[Edgerunner] Auth error during bet placement: ${betError.message}. Re-signing in...`));
							const signInResult = await this.bookmaker.signin(this.username, this.password);
							if (signInResult.success) {
								console.log('[Edgerunner] Sign-in successful. Retrying bet placement...');
								await this.bookmaker.placeBet(this.username, betPayload);
							}
						} else {
							throw betError;
						}
					}
				} else {
					console.log('[Edgerunner] No value according to Kelly Criterion, skipping bet.');
				}
			} catch (error) {
				console.error(`[Edgerunner] Error processing provider data ${providerData.id}:`, error);
			} finally {
				await new Promise(resolve => setTimeout(resolve, configurations.bookmaker.interval * 1000));
			}
		}
		this.#isWorkerRunning = false;
		console.log('[Edgerunner] Queue is empty. Worker is now idle.');
	}

	async start() {
		// not so sure about this check comeback later
		if (this.provider.state.isRunning) {
			console.log(chalk.yellow(`[Edgerunner] Already polling for ${this.config.edgeRunner.name}, skipping start.`));
			return;
		}
		console.log(chalk.green(`[Edgerunner] Starting bot: ${this.config.edgeRunner.name}`));

		await this.initialize();

		this.provider.startPolling();
		this.provider.on('notifications', (games) => {
			if (!games || games.length === 0) {
				console.log('[Edgerunner] No games received in notification.');
				return;
			}
			if (games.length === 250) {
				console.log('[Edgerunner] Skipping bulk 250 games.');
				return;
			}

			console.log(chalk.cyan(`[Edgerunner] Received ${games.length} games`));
			games.forEach(game => {
				if (game.id && !this.#seenGameIds.has(game.id)) {
					this.#gameQueue.push(game);
					this.#seenGameIds.add(game.id);
					console.log(chalk.cyan(`[Edgerunner] Added game ID ${game.id} to queue`));
				} else if (game.id) {
					console.log(chalk.yellow(`[Edgerunner] Skipped duplicate game ID ${game.id}`));
				} else {
					console.log(chalk.yellow('[Edgerunner] Skipped game with missing id:', JSON.stringify(game)));
				}
			});
			this.#processQueue();
		});
	}

	async stop() {
		this.provider.stopPolling();
		this.#isWorkerRunning = false;
		this.#gameQueue.length = 0; // Clear queue
		this.#seenGameIds.clear(); // Clear seen IDs
		if (this.browser) {
			console.log('[Browser] Closing browser instance');
			await this.browser.close();
			this.browser = null;
		}
		console.log(chalk.yellow(`[Edgerunner] Stopped bot: ${this.config.name}`));
	}

	getStatus() {
		return {
			bankroll: this.bankroll,
			queueLength: this.#gameQueue.length,
			isWorkerRunning: this.#isWorkerRunning,
			browserActive: !!this.browser
		};
	}
}

export default EdgeRunner;
