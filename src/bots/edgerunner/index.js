import fs from 'fs/promises';
import path from 'path';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import { getBookmakerInterface } from '../../interfaces/bookmakers/index.js';
import { getProviderInterface } from '../../interfaces/providers/index.js';
import chalk from 'chalk';
import { AuthenticationError } from '../../core/errors.js';

puppeteer.use(stealthPlugin());

class EdgeRunner {
	#gameQueue = [];
	#processedEventIds = new Set();
	#isWorkerRunning = false;
	#isBotActive = false;
	#CORRELATED_DUMP_PATH = path.join(process.cwd(), 'data', 'correlated_matches.json');

	constructor(config, browser, bookmaker) {
		this.config = config;
		this.bankroll = null;
		this.openBets = null;
		this.username = config.bookmaker.username;
		this.password = config.bookmaker.password;
		this.browser = browser;
		this.bookmaker = bookmaker;
		this.provider = getProviderInterface(config.provider.name, config.provider);
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
			if (this.browser && this.bookmaker) {
				console.log(chalk.yellow('[EdgeRunner] Already initialized, skipping.'));
				return;
			}
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

	#handleProviderNotifications(providerGames) {
		if (!providerGames || providerGames.length === 0) {
			console.log('[Edgerunner] No games received in notification.');
			return;
		}
		if (providerGames.length === 250) {
			console.log('[Edgerunner] Skipping bulk 250 games.');
			return;
		}

		console.log(chalk.cyan(`[Edgerunner] Received ${providerGames.length} games`));
		providerGames.forEach(game => {
			if (game.eventId && !this.#processedEventIds.has(game.eventId)) {
				this.#gameQueue.push(game);
				this.#processedEventIds.add(game.eventId); // Add the eventId to the set
				console.log(chalk.cyan(`[Edgerunner] Added game with event ID ${game.eventId} to queue`));
			} else if (game.eventId) {
				console.log(chalk.yellow(`[Edgerunner] Skipped duplicate event ID ${game.eventId}`));
			} else {
				console.log(chalk.yellow('[Edgerunner] Skipped game with missing eventId:', JSON.stringify(game)));
			}
		});
		this.#processQueue();
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

	async evaluateMarket(bookmakerMarkets, providerMarkets) {
		try {
			const groupedMatches = this.bridgeMarket(bookmakerMarkets, providerMarkets);
			if (!groupedMatches || Object.keys(groupedMatches).length === 0) {
				console.log('[Edgerunner] No matching markets found.');
				return [];
			}

			const valueBets = [];

			const calculateValue = (matchedBet) => {
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

			for (const marketName in groupedMatches) {
				const marketGroup = groupedMatches[marketName];
				const valuedBets = marketGroup.map(calculateValue);
				if (!valuedBets || valuedBets.length === 0 || !valuedBets[0]) { continue; }

				const bestBetInGroup = valuedBets.reduce((best, current) => {
					return (current.value > best.value) ? current : best;
				}, valuedBets[0]);
				if (!bestBetInGroup || bestBetInGroup.value === -Infinity) { continue; }

				// -- DIAGNOSTIC LOG ---
				let diagnosticLog = `[Edgerunner] Market Analysis: ${marketName}\n`;
				for (const bet of valuedBets) {
					const isBest = (bet.bookmaker.selection.id === bestBetInGroup.bookmaker.selection.id);
					const icon = isBest ? '✅' : '➖';
					const selectionName = bet.bookmaker.selection.name;
					const valueText = `Value: ${bet.value.toFixed(2)}%`;
					const oddsText = `@ ${bet.bookmaker.selection.odd.value}`;
					diagnosticLog += `  ${icon} ${selectionName.padEnd(15)} ${oddsText.padEnd(8)} ${valueText}\n`;
				}
				this.#sendLog(diagnosticLog);
				console.log(chalk.gray(diagnosticLog));

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

			const bookmakerSelections = bookmakerMarkets.flatMap(market =>
				market.selections.map(selection => ({
					searchable: {
						name: market.name,
						outcome: selection.name,
						specialValue: market.specialValue
					},
					original: { market, selection }
				}))
			);

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
							const specialValueMatches = needsSpecialValueCheck ? s.specialValue === valueToMatch : true;
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

			return groupedMatches;

		} catch (error) {
			console.error('[Edgerunner] Error bridging markets:', error);
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
				this.openBets = accountInfo.openBetsCount;
			} catch (error) {
				if (error instanceof AuthenticationError) {
					console.log(chalk.yellow(`[Edgerunner] Auth error: ${error.message}. Attempting to sign in...`));
					const signInResult = await this.bookmaker.signin(this.username, this.password);
					if (signInResult.success) {
						const accountInfo = await this.bookmaker.getAccountInfo(this.username);
						if (accountInfo) {
							this.bankroll = accountInfo.balance;
							this.openBets = accountInfo.openBetsCount;
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

				const valueBets = await this.evaluateMarket(bookmakerMarkets, providerMarkets);

				if (!valueBets || valueBets.length === 0) {
					console.log('[Edgerunner] No value bets found for this match.');
					continue;
				}

				console.log(chalk.greenBright(`[Edgerunner] Found ${valueBets.length} value opportunities.`));
				this.#sendLog(`[Edgerunner] Found ${valueBets.length} value opportunities.`);
				for (const valueBet of valueBets) {
					const valueBetMessage = `📈 **Value Bet Found**\n` +
						`> **Sport:** ${detailedBookmakerData.eventCategory}\n` +
						`> **Match:** ${detailedBookmakerData.name}\n` +
						`> **Market:** ${valueBet.market.name}\n` +
						`> **Selection:** ${valueBet.selection.name}\n` +
						`> **Points:** ${valueBet.market.specialValue || "none"}\n` +
						`> **Odds:** ${valueBet.selection.odd.value}\n` +
						`> **Value:** ${valueBet.value.toFixed(2)}%`;
					this.#sendLog(valueBetMessage);

					const stakeAmount = this.edgerunnerConf.fixedStake.enabled
						? this.edgerunnerConf.fixedStake.value
						: this.#calculateStake(valueBet.trueOdd, valueBet.bookmakerOdds, this.bankroll);

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
							await this.bookmaker.placeBet(this.username, betPayload);
							console.log(chalk.bold.magenta('[Edgerunner] Bet placed successfully'));
							const successMessage = `✅ **Bet Placed Successfully!**\n`
								+ `> **Sport:** ${detailedBookmakerData.eventCategory}\n`
								+ `> **Stake:** $${stakeAmount.toFixed(2)}\n`
								+ `> **Match:** ${detailedBookmakerData.name}\n`
								+ `> **Market:** ${valueBet.market.name}\n`
								+ `> **Selection:** ${valueBet.selection.name}\n`
								+`> **Points:** ${valueBet.market.specialValue || "none"}\n` 
								+ `> **Odds:** ${valueBet.selection.odd.value}`;
							this.#sendLog(successMessage);

							const updatedAccountInfo = await this.bookmaker.getAccountInfo(this.username);
							if (updatedAccountInfo) {
								this.bankroll = updatedAccountInfo.balance;
								console.log(chalk.cyan(`[Edgerunner] Bankroll updated to: ${this.bankroll}`));
							}
						} catch (betError) {
							if (betError instanceof AuthenticationError) {
								console.log(chalk.yellow(`[Edgerunner] Auth error during bet placement: ${betError.message}. Re-signing in...`));
								this.#sendLog(`⚠️ **Bet Failed:** Authentication error during placement. Re-signing in...`);
								const signInResult = await this.bookmaker.signin(this.username, this.password);
								if (signInResult.success) {
									console.log('[Edgerunner] Sign-in successful. Retrying bet placement...');
									await this.bookmaker.placeBet(this.username, betPayload);
								}
							} else {
								this.#sendLog(`❌ **Bet Failed:** An unexpected error occurred. Reason: ${betError.message}`);
								throw betError;
							}
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
		this.#isWorkerRunning = false;
		console.log('[Edgerunner] Queue is empty. Worker is now idle.');
	}

	async start() {
		if (this.#isBotActive) {
			console.log(chalk.yellow(`[Edgerunner] Already polling for ${this.edgerunnerConf.name}, skipping start.`));
			return;
		}
		this.#isBotActive = true;
		console.log(chalk.green(`[Edgerunner] Starting bot: ${this.edgerunnerConf.name}`));
		this.#sendLog(`🚀 **Bot Started** for **${this.edgerunnerConf.name}**.`);
		this.provider.startPolling();
		this.provider.on('notifications', this.#handleProviderNotifications.bind(this));
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

	getStatus() {
		return {
			isBotActive: this.#isBotActive,
			bankroll: this.bankroll,
			openBets: this.openBets,
			queueLength: this.#gameQueue.length,
			isWorkerRunning: this.#isWorkerRunning,
			browserActive: !!this.browser,
			minValueBetOdds: this.edgerunnerConf.minValueBetOdds,
			maxValueBetOdds: this.edgerunnerConf.maxValueBetOdds,
		};
	}
}

export default EdgeRunner;
