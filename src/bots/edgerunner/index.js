import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getBookmakerInterface } from '../../interfaces/bookmakers/index.js';
import { getProviderInterface } from '../../interfaces/providers/index.js';
import chalk from 'chalk';
import Logger from '../../core/logger.js';
import { AuthenticationError } from '../../core/errors.js';

puppeteer.use(stealthPlugin());

class EdgeRunner {
	#gameQueue = [];
	#processedEventIds = new Set();
	#isWorkerRunning = false;
	#isBotActive = false;
	#CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data/logs', 'provider_bookmaker_correlated.json');

	constructor(config, browser, bookmaker) {
		this.config = config;
		this.bankroll = null;
		this.openBets = null;
		this.username = config.bookmaker.username;
		this.password = config.bookmaker.password;
		this.browser = browser;
		this.bookmaker = bookmaker;
		this.provider = getProviderInterface(config.provider.name, config.provider);
		this.logger = new Logger(this.#sendLog.bind(this));
		this.edgerunnerConf = config.edgerunner;
	}

	static async create(config) {
		if (!config) {
			throw new Error("Configuration object is missing.");
		}
		try {
			const browser = await this.#initializeBrowser();
			const bookmaker = getBookmakerInterface(config.bookmaker.name, config.bookmaker, browser);

			return new EdgeRunner(config, browser, bookmaker);
		} catch (error) {
			console.error(chalk.red('[EdgeRunner] Failed to create instance:', error));
			throw error;
		}
	}

	static async #initializeBrowser() {
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
	#sendLog(message) {
		// process.send is only available when running as a forked child process
		// use to log on discord or front end consumer
		if (process.send) {
			process.send({ type: 'log', message });
		}
	}

	async #ensureAuthenticated() {
		console.log('[Edgerunner] Verifying authentication status...');
		try {
			// We use getAccountInfo as a heartbeat to check if we're logged in.
			const accountInfo = await this.bookmaker.getAccountInfo(this.username);
			if (accountInfo) {
				console.log('[Edgerunner] Authentication is still valid.');
				this.bankroll = accountInfo.balance; // Keep bankroll updated
				this.openBets = accountInfo.openBetsCount;
				return true;
			}
			throw new AuthenticationError('Session expired or not logged in.');
		} catch (error) {
			console.log(chalk.yellow('[Edgerunner] Authentication check failed. Attempting to sign in...'));
			this.#sendLog(`⚠️ **Authentication Required:** Attempting to sign in...`);

			const signInResult = await this.bookmaker.signin(this.username, this.password);
			if (signInResult.success) {
				console.log('[Edgerunner] Sign-in successful.');
				this.#sendLog('✅ Sign-in successful.');
				// Verify by fetching account info again
				const newAccountInfo = await this.bookmaker.getAccountInfo(this.username);
				if (newAccountInfo) {
					this.bankroll = newAccountInfo.balance;
					this.openBets = newAccountInfo.openBetsCount;
					return true;
				}
			}

			const failureMsg = `Could not re-authenticate. Reason: ${signInResult.reason || 'Failed to get account info after sign-in.'}`;
			this.#sendLog(`❌ **Critical Failure:** ${failureMsg}`);
			throw new AuthenticationError(failureMsg);
		}
	}

	async #performAuthenticatedAction(action) {
		try {
			return await action();
		} catch (error) {
			if (error instanceof AuthenticationError) {
				console.log(chalk.yellow(`[Edgerunner] Authentication error during action. Re-authenticating...`));
				await this.#ensureAuthenticated();

				console.log('[Edgerunner] Retrying original action...');
				return await action();
			}
			throw error;
		}
	}

	#handleProviderNotifications(providerGames) {
		if (!providerGames || providerGames.length === 0) {
			console.log('[Edgerunner] No games received in notification.');
			return;
		}
		if (providerGames.length === 250) {
			console.log('[Edgerunner] Skipping bulk 250 games.');
			return;
		}

		console.log(chalk.cyan(`[Edgerunner] Received ${providerGames.length} games to schedule...`));
		const fixedDelay = (this.edgerunnerConf.delay || 60) * 1000;

		providerGames.forEach(game => {
			if (!game.eventId || this.#processedEventIds.has(game.eventId)) {
				if (game.eventId) {
					console.log(chalk.yellow(`[Edgerunner] Skipped duplicate event ID ${game.eventId}`));
				} else {
					console.log(chalk.yellow('[Edgerunner] Skipped game with missing eventId:', JSON.stringify(game)));
				}
				return;
			}
			this.#processedEventIds.add(game.eventId);
			setTimeout(() => {
				this.#gameQueue.push(game);
				console.log(chalk.cyan(`[Edgerunner] Added game with event ID ${game.eventId} to queue.`));
				if (!this.#isWorkerRunning) {
					this.#processQueue();
				}
			}, fixedDelay);

			const waitTime = Math.round(fixedDelay / 1000);
			console.log(chalk.yellow(`[Edgerunner] Scheduling game ${game.eventId} to be queued in ${waitTime}s.`));
		});

		if (this.#processedEventIds.size > 100) {
			const newIds = Array.from(this.#processedEventIds).slice(50);
			this.#processedEventIds = new Set(newIds);
			console.log('[Edgerunner] Cleaned up old event IDs to prevent memory leak.');
		}
	}

	async #saveSuccessfulMatch(matchData, providerData) {
		if (this.config.bookmaker.storeData) {
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

		const stakeFraction = this.edgerunnerConf.stakeFraction || 0.1;
		const fullStake = bankroll * (numerator / b);
		const finalStake = Math.floor((fullStake * stakeFraction) * 100) / 100;

		return finalStake;
	}

	calculateValue(matchedBet) {
		const { bookmaker, provider } = matchedBet;
		const data = provider.fullLineData;
		const nonOddKeys = new Set(['lineType', 'points', 'hdp', 'alt_line_id', 'max']);
		const { outcomeKeys, oddsArray } = Object.entries(data).reduce((acc, [key, value]) => {
			if (!nonOddKeys.has(key) && typeof value === 'number') {
				acc.outcomeKeys.push(key);
				acc.oddsArray.push(value);
			}
			return acc;
		}, { outcomeKeys: [], oddsArray: [] });
		if (oddsArray.length < 2) return { ...matchedBet, value: -Infinity };
		const noVigOddsArray = this.provider.devigOdds(oddsArray);

		if (!noVigOddsArray) return { ...matchedBet, value: -Infinity };
		const noVigOdds = Object.fromEntries(outcomeKeys.map((key, i) => [key, noVigOddsArray[i]]));
		const trueOdd = noVigOdds[provider.matchedOutcome.name];

		if (!trueOdd) return { ...matchedBet, value: -Infinity };
		const value = (bookmaker.selection.odd.value / trueOdd - 1) * 100;

		return { ...matchedBet, value, trueOdd };
	};

	async evaluateMarket(bookmakerMarkets, providerMarkets) {
		try {
			const groupedMatches = this.bridgeMarket(bookmakerMarkets, providerMarkets);
			if (!groupedMatches || Object.keys(groupedMatches).length === 0) {
				console.log('[Edgerunner] No matching markets found.');
				return [];
			}

			const valueBets = [];
			const bestBetsForTable = [];

			for (const marketName in groupedMatches) {
				const marketGroup = groupedMatches[marketName];
				const valuedBets = marketGroup.map(bet => this.calculateValue(bet));
				if (!valuedBets || valuedBets.length === 0 || !valuedBets[0]) { continue; }

				const bestBetInGroup = valuedBets.reduce((best, current) => {
					return (current.value > best.value) ? current : best;
				}, { value: -Infinity });
				bestBetsForTable.push({ marketName, ...bestBetInGroup });
				if (!bestBetInGroup || bestBetInGroup.value === -Infinity) { continue; }

				const bookmakerOdds = bestBetInGroup.bookmaker.selection.odd.value;
				const meetsValuePercentage = bestBetInGroup.value > (this.edgerunnerConf.minValueBetPercentage || 0);
				const meetsValueOdds = bookmakerOdds >= (this.edgerunnerConf.minValueBetOdds || 1) && bookmakerOdds <= (this.edgerunnerConf.maxValueBetOdds || Infinity);

				if (bestBetInGroup && meetsValuePercentage && meetsValueOdds) {
					valueBets.push({
						market: bestBetInGroup.bookmaker.market,
						selection: bestBetInGroup.bookmaker.selection,
						value: bestBetInGroup.value,
						trueOdd: bestBetInGroup.trueOdd,
						bookmakerOdds: bestBetInGroup.bookmaker.selection.odd.value,
					});
				}
			}

			// -- DIAGNOSTIC LOG ---
			this.logger.logBestInMarket(bestBetsForTable);

			valueBets.sort((a, b) => b.value - a.value);
			return valueBets;

		} catch (error) {
			console.error('[Edgerunner] Error finding best value bets:', error);
			return [];
		}
	}

	bridgeMarket(bookmakerMarkets, providerMarkets) {
		try {
			const normalizeProvider = (d) => ({ ...d, money_line: d.money_line ? { main: d.money_line } : undefined });
			const normalizedProviderMarkets = normalizeProvider(providerMarkets);
			const sportId = providerMarkets.sportId || '1';

			const bookmakerSelections = bookmakerMarkets.flatMap(market => {
				// Start with the selections from the parent market itself
				let allSelections = market.selections.map(selection => ({
					searchable: {
						name: market.name,
						outcome: selection.name,
						specialValue: market.specialValue
					},
					original: { market, selection }
				}));

				// If a nested spreadMarkets array exists, process its contents too
				if (market.spreadMarkets && Array.isArray(market.spreadMarkets)) {
					const nestedSelections = market.spreadMarkets.flatMap(nestedMarket =>
						nestedMarket.selections.map(selection => ({
							searchable: {
								name: nestedMarket.name,
								outcome: selection.name,
								specialValue: nestedMarket.specialValue
							},
							original: { market: nestedMarket, selection }
						}))
					);
					allSelections = allSelections.concat(nestedSelections);
				}

				return allSelections;
			});

			const groupedMatches = {};

			for (const [line, submarkets] of Object.entries(normalizedProviderMarkets)) {
				const mapping = this.bookmaker.lineTypeMapper[line];
				if (!mapping || !submarkets) continue;

				const sportMapping = mapping.sport[sportId];
				const sportConfig = sportMapping?.['*'] || mapping.sport['*']?.['*'];

				if (!sportConfig) continue;

				const bridge = sportMapping.bridge || {};

				for (const [subKey, outcomes] of Object.entries(submarkets)) {
					for (const [outcome, odd] of Object.entries(outcomes)) {

						const specialMapping = bridge.specials?.[subKey];

						const outcomeMap = specialMapping?.outcome || sportConfig.outcome;
						if (!outcomeMap[outcome]) continue;

						const searchName = specialMapping?.name || sportConfig.label || mapping.name;
						const searchOutcome = outcomeMap[outcome];
						const useExactNameMatch = !!specialMapping;
						const needsSpecialValueCheck = !specialMapping && line !== 'money_line';
						const valueToMatch = needsSpecialValueCheck
							? (bridge[subKey] ?? bridge[String(parseFloat(subKey))] ?? subKey)
							: null;

						const gameFound = bookmakerSelections.find((sel) => {
							const s = sel.searchable;
							const nameMatches = useExactNameMatch ? s.name.toLowerCase() === searchName.toLowerCase() : s.name.toLowerCase().startsWith(searchName.toLowerCase());
							const outcomeMatches = s.outcome.toLowerCase() === searchOutcome.toLowerCase();
							const specialValueMatches = needsSpecialValueCheck ? String(s.specialValue) === String(valueToMatch) : true;
							return nameMatches && outcomeMatches && specialValueMatches;
						});

						if (gameFound) {
							const groupKey = gameFound.searchable.name.toLowerCase();
							if (!groupedMatches[groupKey]) {
								groupedMatches[groupKey] = [];
							}

							groupedMatches[groupKey].push({
								bookmaker: gameFound.original,
								provider: {
									lineType: line,
									lineValue: subKey,
									matchedOutcome: { name: outcome, odd: odd },
									fullLineData: { ...outcomes, lineType: line },
									sportId: providerMarkets.sportId,
									periodNumber: providerMarkets.periodNumber
								}
							});
						}
					}
				}
			}

			// --- START: Unified Minimalist Log ---
			this.logger.logBridgedMarkets(groupedMatches, this.calculateValue.bind(this));

			return groupedMatches;

		} catch (error) {
			console.error('[Edgerunner] Error bridging markets:', error);
			return null;
		}
	}


	async #processQueue() {
		if (this.#isWorkerRunning) return;
		this.#isWorkerRunning = true;

		try {
			if (this.bankroll === null) {
				try {
					await this.#ensureAuthenticated();
				} catch (error) {
					const finalErrorMessage = '🛑 **Bot Stopping:** Could not establish initial bankroll. Please check credentials or website status.';
					console.error(chalk.red(`[Edgerunner] ${finalErrorMessage}`), error);
					this.#sendLog(finalErrorMessage);
					this.#isWorkerRunning = false;
					process.exit(1);
				}
			}

			try {
				console.log(chalk.blue('[Edgerunner] Refreshing account info before processing queue...'));
				await this.#ensureAuthenticated();
			} catch (error) {
				console.error(chalk.red('[Edgerunner] Could not refresh bankroll. Staking might be based on stale data.'));
				this.#sendLog('⚠️ **Warning:** Could not refresh bankroll before processing.');
			}

			console.log(chalk.green(`[Edgerunner] Worker processing queue. Current bankroll: ${this.bankroll}.`));

			while (this.#gameQueue.length > 0) {
				const providerData = this.#gameQueue.shift(); // FIFO
				try {
					console.log(chalk.blueBright(`\n[EDGERUNNER] Processing: ${providerData.home} vs ${providerData.away}`));

					const potentialMatch = await this.bookmaker.getMatchDataByTeamPair(providerData.home, providerData.away);
					if (!potentialMatch) {
						console.log(`[Edgerunner] Match not found for ${providerData.home} vs ${providerData.away}`);
						continue;
					}
					console.log(`[Edgerunner] Potential Match Found: ${potentialMatch.EventName}`);

					const detailedBookmakerData = await this.bookmaker.getMatchDetailsByEvent(
						potentialMatch.IDEvent,
						potentialMatch.EventName
					);
					if (!detailedBookmakerData) {
						console.log(`[Edgerunner] Failed to fetch full bookmaker data.`);
						continue;
					}

					const bookmakerTime = detailedBookmakerData.date;
					const providerTime = providerData.starts;
					const isMatchVerified = await this.bookmaker.verifyMatch(bookmakerTime, providerTime);
					if (!isMatchVerified) {
						console.log(`[Edgerunner] Match Time Mismatch Discarded: ${detailedBookmakerData.name}`);
						continue;
					}
					console.log('[Edgerunner] Match Time Verified For:', detailedBookmakerData.name);

					await this.#saveSuccessfulMatch(detailedBookmakerData, providerData);

					const detailedProviderPayload = await this.provider.getDetailedInfo(providerData.eventId);
					if (!detailedProviderPayload?.data?.periods?.num_0) {
						console.log(`[Edgerunner] Main market data not found in detailed provider info.`);
						continue;
					}
					const providerMainMarket = detailedProviderPayload.data.periods.num_0;

					const bookmakerMarkets = detailedBookmakerData.markets;
					const providerMarkets = {
						money_line: providerMainMarket.money_line,
						spreads: providerMainMarket.spreads,
						totals: providerMainMarket.totals,
						team_total: providerMainMarket.team_total,
						sportId: providerData.sportId,
						periodNumber: 0
					};

					// log header
					this.logger.logGameHeader(providerData, this.bookmaker.sportIdMapper);

					const valueBets = await this.evaluateMarket(bookmakerMarkets, providerMarkets);
					if (!valueBets || valueBets.length === 0) {
						const noValueMessage = `No value opportunities found for this match.`;
						console.log(`[Edgerunner] ${noValueMessage}`);
						this.#sendLog(noValueMessage);
						continue;
					}

					// log values
					this.logger.logValueOpportunities(valueBets);

					for (const valueBet of valueBets) {
						// bet found
						const stakeAmount = this.edgerunnerConf.fixedStake.enabled
							? this.edgerunnerConf.fixedStake.value
							: this.#calculateStake(valueBet.trueOdd, valueBet.bookmakerOdds, this.bankroll);

						this.logger.logPendingBet({ detailedBookmakerData, valueBet, stakeAmount });

						if (stakeAmount > 0) {
							const summary = {
								type: 'bet',
								data: {
									match: detailedBookmakerData.name,
									market: valueBet.market.name,
									selection: valueBet.selection.name,
									odds: valueBet.selection.odd.value,
									stake: stakeAmount,
									value: `${valueBet.value.toFixed(2)}%`
								}
							};
							console.log(chalk.greenBright('[Edgerunner] Placing Bet:'), summary.data);

							try {
								const betPayload = this.bookmaker.constructBetPayload(
									detailedBookmakerData,
									valueBet.market,
									valueBet.selection,
									stakeAmount,
									providerData
								);
								await this.#performAuthenticatedAction(async () => {
									await this.bookmaker.placeBet(this.username, betPayload);
								});
								console.log(chalk.bold.magenta('[Edgerunner] Bet placed successfully'));
								// log succesfully
								this.logger.logSuccess({ detailedBookmakerData, valueBet, stakeAmount });

								const updatedAccountInfo = await this.bookmaker.getAccountInfo(this.username);
								if (updatedAccountInfo) {
									this.bankroll = updatedAccountInfo.balance;
									console.log(chalk.cyan(`[Edgerunner] Bankroll updated to: ${this.bankroll}`));
								}
							} catch (betError) {
								console.error(chalk.red(`[Edgerunner] Failed to place bet after retry:`), betError);
								this.#sendLog(`❌ **Bet Failed:** An unexpected error occurred. Reason: ${betError.message}`);
							}
						} else {
							console.log('[Edgerunner] Stake is zero or less, skipping bet for:', valueBet.market.name, valueBet.selection.name);
						}
					}

				} catch (error) {
					console.error(`[Edgerunner] Error processing provider data ${providerData.id}:`, error);
				} finally {
					await new Promise(resolve => setTimeout(resolve, this.config.bookmaker.interval * 1000));
				}
			}
		} catch (error) {
			console.error(chalk.red('[Edgerunner] A fatal, unexpected error occurred in the queue processor:'), error);
			this.#sendLog(`🛑 **Fatal Worker Error:** The queue processor has crashed. Check logs.`);
		} finally {
			this.#isWorkerRunning = false;
			console.log('[Edgerunner] Queue processing cycle finished. Worker is now idle.');
		}
	}

	async start() {
		if (this.#isBotActive) {
			console.log(chalk.yellow(`[Edgerunner] Already polling, skipping start.`));
			return;
		}
		this.#isBotActive = true;
		console.log(chalk.green(`[Edgerunner] Starting bot: ${this.edgerunnerConf.name}`));
		this.#sendLog(`🚀 **Bot Started** for **${this.config.bookmaker.username}**.`);

		this.provider.on('fatal', (errorMessage) => {
			this.#sendLog(`🛑 **Provider Error:** ${errorMessage}`);
			this.stop();
		});

		this.provider.on('notifications', this.#handleProviderNotifications.bind(this));

		try {
			this.provider.startPolling();
		} catch (error) {
			this.#sendLog(`🛑 **Provider Error:** ${error.message}`);
			this.#isBotActive = false;
			process.exit(1);
		}
	}
	async stop() {
		this.provider.off('notifications', this.#handleProviderNotifications.bind(this));
		this.provider.stopPolling();
		this.#isWorkerRunning = false;
		this.#gameQueue.length = 0;
		this.#processedEventIds.clear();
		this.#isBotActive = false;
		if (this.browser) {
			console.log('[Browser] Closing browser instance');
			await this.browser.close();
			this.browser = null;
		}
		this.#sendLog(`🛑 **Bot Stopped** for ${this.config.bookmaker.username}.`);
		console.log(chalk.yellow(`[Edgerunner] Stopped bot: ${this.config.name}`));
	}

	async getStatus() {
		// Explicitly get the status objects first
		const providerStatusObject = this.provider.getStatus();
		const bookmakerStatusObject = this.bookmaker.getStatus();

		// Create the final status object that will be returned
		const finalStatus = {
			// Internal Bot Status
			isBotActive: this.#isBotActive,
			isWorkerRunning: this.#isWorkerRunning,
			queueLength: this.#gameQueue.length,
			// Live Data
			bankroll: this.bankroll,
			openBets: this.openBets,
			// Connection Health - Using the objects from above
			provider: providerStatusObject,
			bookmaker: bookmakerStatusObject,
			// Configuration
			browserActive: !!this.browser,
			minValueBetOdds: this.edgerunnerConf.minValueBetOdds,
			maxValueBetOdds: this.edgerunnerConf.maxValueBetOdds,
		};

		// THIS IS THE MOST IMPORTANT LOG
		// It will show us the exact object right before it gets sent.
		console.log(chalk.magenta('[DEBUG] Final status object constructed:'), JSON.stringify(finalStatus, null, 2));
		return finalStatus;
	}
}

export default EdgeRunner;
