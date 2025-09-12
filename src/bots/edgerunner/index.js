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
			const browser = await this.#initializeBrowser(config);
			const bookmaker = getBookmakerInterface(config.bookmaker.name, config.bookmaker, browser);

			return new EdgeRunner(config, browser, bookmaker);
		} catch (error) {
			console.error(chalk.red('[EdgeRunner] Failed to create instance:', error));
			throw error;
		}
	}

	static async #initializeBrowser(config) {
		try {
			const launchOptions = {
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
			}

			const proxyConf = config.proxy;
			if (proxyConf && proxyConf.enabled && proxyConf.ip) {
				console.log(chalk.blue(`[Browser] -> Attempting to use proxy ip: ${proxyConf.ip}`));
				launchOptions.args.push(`--proxy-server=${proxyConf.ip}`);
			}

			const browser = await puppeteer.launch(launchOptions);

			if (proxyConf && proxyConf.enabled && proxyConf.username && proxyConf.password) {
			}

			if (proxyConf && proxyConf.enabled) {
				console.log(chalk.yellow('[Proxy Test] -> Validating proxy connection...'));
				let testPage;
				try {
					testPage = await browser.newPage();
					if (proxyConf.username && proxyConf.password) {
						await testPage.authenticate({
							username: proxyConf.username,
							password: proxyConf.password
						});
					}
					await testPage.goto('https://api.ipify.org', {
						timeout: 15000,
						waitUntil: 'domcontentloaded'
					});

					const detectedIp = await testPage.evaluate(() => document.body.innerText);
					const expectedIp = proxyConf.ip.split(':')[0];

					if (detectedIp.includes(expectedIp)) {
						console.log(chalk.green.bold(`[Proxy Test] -> ✅ Proxy connection successful! IP: ${detectedIp}`));
					} else {
						console.log(chalk.red.bold(`[Proxy Test] -> ⚠️ PROXY MISMATCH! Connection is live, but IP is wrong.`));
						console.log(chalk.red(`   Expected: ${expectedIp} | Detected: ${detectedIp}`));
						throw new Error('Proxy connected but IP did not match configuration.');
					}

					await testPage.close();

				} catch (error) {
					console.error(chalk.red.bold('[Proxy Test] -> ❌ Proxy connection FAILED.'));
					if (!error.message.includes('Proxy connected but IP did not match')) {
						console.error(chalk.red('Error: The proxy may be offline, IP is incorrect, or credentials failed.'));
					}
					if (testPage) {
						await testPage.close();
					}
					await browser.close();
					throw new Error(`Proxy validation failed: ${error.message}`);
				}
			}

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
				let allSelections = (market.selections || []).map(selection => ({
					searchable: { name: market.name, outcome: selection.name, specialValue: market.specialValue },
					original: { market, selection }
				}));
				if (market.spreadMarkets && Array.isArray(market.spreadMarkets)) {
					const nestedSelections = market.spreadMarkets.flatMap(nestedMarket =>
						(nestedMarket.selections || []).map(selection => ({
							searchable: { name: nestedMarket.name, outcome: selection.name, specialValue: nestedMarket.specialValue },
							original: { market: nestedMarket, selection }
						}))
					);
					allSelections = allSelections.concat(nestedSelections);
				}
				return allSelections;
			});

			const groupedMatches = {};

			for (const [line, submarkets] of Object.entries(normalizedProviderMarkets)) {
				const mappingConfig = this.bookmaker.lineTypeMapper[line];
				if (!mappingConfig || !submarkets) continue;

				const sportMapping = mappingConfig.sport[sportId];
				if (!sportMapping) continue;

				if (line === 'spreads') {
					const bridge = sportMapping.bridge;
					if (!bridge) continue;

					for (const [subKey, outcomes] of Object.entries(submarkets)) {
						const mapping = bridge[subKey];
						if (!mapping) continue;

						for (const side of ['home', 'away']) {
							const sideRule = mapping[side];
							if (!sideRule) continue;

							const providerLineToUse = sideRule.provider.line;
							const providerOutcomeToUse = sideRule.provider.outcome;
							const providerDataForCalc = submarkets[providerLineToUse];

							if (!providerDataForCalc) continue;
							const providerOddForCalc = providerDataForCalc[providerOutcomeToUse];
							if (typeof providerOddForCalc !== 'number') continue;

							const bookmakerRule = sideRule.bookmaker;
							const gameFound = bookmakerSelections.find(sel => {
								const s = sel.searchable;
								if (bookmakerRule.marketName) {
									return s.name.replace(/\s/g, '') === bookmakerRule.marketName.replace(/\s/g, '') && s.outcome === bookmakerRule.outcome;
								}
								return s.specialValue.replace(/\s/g, '') === bookmakerRule.specialValue.replace(/\s/g, '') && s.outcome === bookmakerRule.outcome;
							});

							if (gameFound) {
								const groupKey = gameFound.searchable.name.toLowerCase();
								if (!groupedMatches[groupKey]) groupedMatches[groupKey] = [];

								groupedMatches[groupKey].push({
									bookmaker: gameFound.original,
									provider: {
										lineType: line, lineValue: subKey,
										matchedOutcome: { name: side, odd: providerOddForCalc },
										fullLineData: providerDataForCalc,
										sportId: providerMarkets.sportId, periodNumber: providerMarkets.periodNumber
									}
								});
							}
						}
					}
				}
				else if (line === 'money_line' || line === 'totals') {
					const sportConfig = sportMapping['*'];
					if (!sportConfig) continue;

					for (const [subKey, outcomes] of Object.entries(submarkets)) {
						for (const outcome of Object.keys(outcomes)) {
							if (typeof outcomes[outcome] !== 'number' || !sportConfig.outcome[outcome]) continue;

							const searchName = sportConfig.label;
							const searchOutcome = sportConfig.outcome[outcome];
							const valueToMatch = (line === 'totals') ? subKey : undefined;

							const gameFound = bookmakerSelections.find(sel => {
								const s = sel.searchable;
								const nameMatches = s.name.toLowerCase().startsWith(searchName.toLowerCase());
								const outcomeMatches = s.outcome.toLowerCase() === searchOutcome.toLowerCase();
								const specialValueMatches = valueToMatch ? s.specialValue === valueToMatch : true;
								return nameMatches && outcomeMatches && specialValueMatches;
							});

							if (gameFound) {
								const groupKey = gameFound.searchable.name;
								if (!groupedMatches[groupKey]) groupedMatches[groupKey] = [];
								groupedMatches[groupKey].push({
									bookmaker: gameFound.original,
									provider: {
										lineType: line, lineValue: subKey, matchedOutcome: { name: outcome, odd: outcomes[outcome] },
										fullLineData: outcomes, sportId: providerMarkets.sportId, periodNumber: providerMarkets.periodNumber
									}
								});
							}
						}
					}
				}
			}

			this.logger.logBridgedMarkets(groupedMatches, this.calculateValue.bind(this));
			return groupedMatches;

		} catch (error) {
			console.error('[Edgerunner] Error bridging markets:', error);
			return null;
		}
	}

	async #performPreflightCheck() {
		// check if we can get the bank roll if not exit 
		if (this.bankroll === null) {
			try {
				await this.#ensureAuthenticated();
			} catch (error) {
				const finalErrorMessage = '🛑 **Bot Stopping:** Could not establish initial bankroll.';
				console.error(chalk.red(`[Edgerunner] ${finalErrorMessage}`), error);
				this.#sendLog(`[Edgerunner] Pre-Flight failed: ${finalErrorMessage}`);
				process.exit(1);
			}
		}
	}

	async #placeValueBets(valueBets, detailedBookmakerData, providerData) {
		for (const valueBet of valueBets) {
			const stakeAmount = this.edgerunnerConf.fixedStake.enabled
				? this.edgerunnerConf.fixedStake.value
				: this.#calculateStake(valueBet.trueOdd, valueBet.bookmakerOdds, this.bankroll);

			if (stakeAmount <= 0) {
				console.log('[Edgerunner] Stake is zero or less, skipping bet.');
				continue;
			}

			this.logger.logPendingBet({ detailedBookmakerData, valueBet, stakeAmount });

			try {
				const betPayload = this.bookmaker.constructBetPayload(detailedBookmakerData, valueBet.market, valueBet.selection, stakeAmount, providerData);

				await this.#performAuthenticatedAction(async () => {
					await this.bookmaker.placeBet(this.username, betPayload);
				});

				console.log(chalk.bold.magenta('[Edgerunner] Bet placed successfully'));
				this.logger.logSuccess({ detailedBookmakerData, valueBet, stakeAmount });

				// Refresh bankroll after successful bet
				const updatedAccountInfo = await this.bookmaker.getAccountInfo(this.username);
				if (updatedAccountInfo) {
					this.bankroll = updatedAccountInfo.balance;
					console.log(chalk.cyan(`[Edgerunner] Bankroll updated to: ${this.bankroll}`));
				}
			} catch (betError) {
				console.error(chalk.red(`[Edgerunner] Failed to place bet:`), betError);
				this.#sendLog(`❌ **Bet Failed:** ${betError.message}`);
			}
		}
	}

	async #processGame(providerData) {
		try {
			// Refresh auth status before every game
			try {
				await this.#ensureAuthenticated();
			} catch (error) {
				console.error(chalk.red('[Edgerunner] Could not refresh bankroll. Staking might be based on stale data.'));
				this.#sendLog('⚠️ **Warning:** Could not refresh bankroll before processing.');
			}

			console.log(chalk.blueBright(`\n[EDGERUNNER] Processing: ${providerData.home} vs ${providerData.away}`));

			const potentialMatch = await this.bookmaker.getMatchDataByTeamPair(providerData.home, providerData.away);
			if (!potentialMatch) {
				console.log(`[Edgerunner] Match not found for ${providerData.home} vs ${providerData.away}`);
				return;
			}

			const detailedBookmakerData = await this.bookmaker.getMatchDetailsByEvent(potentialMatch.IDEvent, potentialMatch.EventName);
			if (!detailedBookmakerData) {
				console.log(`[Edgerunner] Failed to fetch full bookmaker data.`);
				return;
			}

			const isMatchVerified = await this.bookmaker.verifyMatch(detailedBookmakerData.date, providerData.starts);
			if (!isMatchVerified) {
				console.log(`[Edgerunner] Match Time Mismatch Discarded: ${detailedBookmakerData.name}`);
				return;
			}
			console.log('[Edgerunner] Match Time Verified For:', detailedBookmakerData.name);

			await this.#saveSuccessfulMatch(detailedBookmakerData, providerData);

			const detailedProviderPayload = await this.provider.getDetailedInfo(providerData.eventId);
			if (!detailedProviderPayload?.data?.periods?.num_0) {
				console.log(`[Edgerunner] Main market data not found in detailed provider info.`);
				return;
			}

			const providerMarkets = {
				money_line: detailedProviderPayload.data.periods.num_0.money_line,
				spreads: detailedProviderPayload.data.periods.num_0.spreads,
				totals: detailedProviderPayload.data.periods.num_0.totals,
				team_total: detailedProviderPayload.data.periods.num_0.team_total,
				sportId: providerData.sportId,
				periodNumber: 0
			};

			this.logger.logGameHeader(providerData, this.bookmaker.sportIdMapper);
			const valueBets = await this.evaluateMarket(detailedBookmakerData.markets, providerMarkets);
			if (!valueBets || valueBets.length === 0) {
				this.#sendLog(`No value opportunities found for this match.`);
				return;
			}

			this.logger.logValueOpportunities(valueBets);
			await this.#placeValueBets(valueBets, detailedBookmakerData, providerData);

		} catch (error) {
			console.error(`[Edgerunner] Error processing provider data for event ${providerData.eventId}:`, error);
		} finally {
			await new Promise(resolve => setTimeout(resolve, this.config.bookmaker.interval * 1000));
		}
	}

	async #processQueue() {
		if (this.#isWorkerRunning) return;
		this.#isWorkerRunning = true;

		try {
			// This new helper handles the critical, one-time startup auth.
			// Perform the critical pre-flight check to ensure the account is ready.
			await this.#performPreflightCheck();
			console.log(chalk.green(`[Edgerunner] Worker processing queue. Current bankroll: ${this.bankroll}.`));
			while (this.#gameQueue.length > 0) {
				const providerData = this.#gameQueue.shift();
				await this.#processGame(providerData);
			}
		} catch (error) {
			console.error(chalk.red('[Edgerunner] A fatal error occurred in the queue processor:'), error);
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
		const providerStatusObject = this.provider.getStatus();
		const bookmakerStatusObject = this.bookmaker.getStatus();
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
		return finalStatus;
	}
}

export default EdgeRunner;
