import Fuse from 'fuse.js';
import { getBrowserInstance } from '../../../../core/browser.js';
import { loadCookies, saveCookies, areCookiesValid, _fetchJsonFromApi, _slugifyEventName } from '../../utils.js';
import { normalizeTeamName } from './betking.utils.js';
import { sportIdMapper } from './betking.mapper.js';
import { URLSearchParams } from 'url';
import chalk from 'chalk';
import { AuthenticationError } from '../../../../core/errors.js';
export { translateProviderData } from './betking.utils.js';

// Fetches basic match data from the API by its numeric ID.
export async function getTeamDataById(matchId) {
	if (!matchId || typeof matchId !== 'string') return null;
	const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Match/${matchId}`;
	return _fetchJsonFromApi(url);
}

// Fetches a list of potential matches from the search API.
export async function getTeamDataByName(searchTerm) {
	if (!searchTerm || typeof searchTerm !== 'string') return null;
	const formattedSearchTerm = encodeURIComponent(searchTerm.trim());
	const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Search/lang/en?search=${formattedSearchTerm}`;
	const data = await _fetchJsonFromApi(url);
	if (!data) return null;
	// filter result to only return matches
	const matches = Array.isArray(data) ? data : data.matches || data.results || [];
	const filteredMatches = matches.filter(match => match.TeamHome && match.TeamAway);
	return filteredMatches;
}

export async function getMatchDataByTeamPair(home, away) {
	if (!home || !away) { return null; }

	const normalizedHome = normalizeTeamName(home);
	const normalizedAway = normalizeTeamName(away);
	const combinedSearchTerm = `${normalizedHome} - ${normalizedAway}`;

	try {
		// Search for both teams in parallel unormalized ---
		console.log(`[Bookmaker] Starting Searching for both "${home}" and "${away}"`);
		const [homeResults, awayResults] = await Promise.all([
			getTeamDataByName(home),
			getTeamDataByName(away)
		]);

		// Combine and de-duplicate the search results using the unique event ID.
		const allMatches = [...(homeResults || []), ...(awayResults || [])];
		const uniqueMatches = Array.from(new Map(allMatches.map(match => [match.IDEvent, match])).values());

		if (!uniqueMatches.length) {
			console.log(`[Bookmaker] No matches found for either "${home}" or "${away}"`);
			return null;
		}

		console.log(`[Bookmaker] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);
		// Add normalized names to each match for fuzzy searching
		const searchableMatches = uniqueMatches.map(match => {
			const apiHome = normalizeTeamName(match.TeamHome);
			const apiAway = normalizeTeamName(match.TeamAway);
			return {
				...match,
				combinedEventName: `${apiHome} - ${apiAway}`
			};
		});

		const fuse = new Fuse(searchableMatches, {
			includeScore: true,
			threshold: 0.4,
			keys: ['combinedEventName']
		});

		const results = fuse.search({
			$or: [
				{ combinedEventName: `${normalizedHome} - ${normalizedAway}` },
				{ combinedEventName: `${normalizedAway} - ${normalizedHome}` }
			]
		});
		console.log(`[Bookmaker] Fuzzy search results for Combined Teams`, results.map(r => {
			const matchPercentage = (1 - r.score) * 100;
			return {
				matchConfidence: `${matchPercentage.toFixed(2)}%`,
				normalizedCombinedSearchTerm: `${combinedSearchTerm}`,
				normalizedCombinedEventName: `${r.item.combinedEventName}`,
				eventName: r.item.EventName
			};
		}));

		if (results.length === 0) {
			console.log(`[Bookmaker] No confident fuzzy match found.`);
			return null;
		}

		const bestResult = results.sort((a, b) => a.score - b.score)[0];
		const bestResultPercentage = (1 - bestResult.score) * 100;

		if (bestResult.score <= 0.4) {
			console.log(chalk.green(`[Bookmaker] Found confident match - score (${bestResultPercentage.toFixed(2)}%): "${bestResult.item.EventName}"`));
			return bestResult.item;
		}

		console.log(chalk.red(`[Bookmaker] No suitable match found - score (${bestResultPercentage.toFixed(2)}%) - above threshold.`));
		return null;

	} catch (error) {
		console.error(`[Bookmaker] Error in getBetKingMatchDataByTeamPair:`, error.message);
		return null;
	}
}

export async function verifyMatch(bookmakerMatch, providerData) {
	if (!providerData.starts || !bookmakerMatch.date) {
		console.error('[Bot] Missing date information for verification.');
		return false;
	}

	try {
		const providerDate = new Date(parseInt(providerData.starts, 10));
		const bookmakerDate = new Date(bookmakerMatch.date);

		// Define a tolerance window (e.g., 5 minutes).
		// It's safer to check if the times are "close enough" rather than exact.
		const fiveMinutesInMs = 5 * 60 * 1000;

		// Calculate the absolute difference in milliseconds.
		const timeDifference = Math.abs(providerDate.getTime() - bookmakerDate.getTime());

		// Return true if the difference is within the tolerance.
		if (timeDifference <= fiveMinutesInMs) {
			console.log(`[Bot] Time verification successful.`);
			return true;
		} else {
			console.log(`[Bot] Time verification failed. Difference: ${timeDifference / 60000} minutes.`);
			return false;
		}

	} catch (error) {
		console.error('[Bot] Error comparing match times:', error);
		return false;
	}
}

export async function getMatchDetailsByEvent(eventId, eventName) {
	if (!eventId || !eventName) return null;

	// sluggify the eventId and eventName to make the request
	const eventSlug = _slugifyEventName(eventName);
	const url = `https://m.betking.com/sports/prematch/${eventId}/${eventSlug}`;
	console.log(`[Bookmaker] Fetching data from page: .../${eventId}/${eventSlug}`);

	// initialize browser and make request to URL
	const browser = getBrowserInstance();
	let page;
	try {
		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on('request', (req) => {
			if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
				req.abort();
			} else {
				req.continue();
			}
		});

		// not sure if this is neccessary
		await browser.setCookie({
			name: 'ABTestNewVirtualsLobby',
			value: 'false',
			domain: 'm.betking.com'
		})

		await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

		const remixContentDetails = await page.evaluate(() => {
			if (window.__remixContext) {
				return window.__remixContext;
			} else {
				throw new Error('Could not find __remixContext on the window object.');
			}
		});

		// extract data from json embedded in the page
		const loaderData = remixContentDetails.state.loaderData;
		const matchEventDetails = loaderData["routes/($locale).sports.prematch.$matchId.$eventName.($areaId)._index"].event;
		// const macthEventMarket = matchEventDetails.markets;
		const matchEventId = matchEventDetails.id;

		if (matchEventId != eventId) {
			throw new Error("Event Id mismatch, Event-Id does not match fetched Match-Details-Event-Id");
		}

		return matchEventDetails;
	} catch (error) {
		console.error(`[Bookmaker] Error extracting Remix JSON on page .../${eventId}/${eventSlug}`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}


export async function signin(username, password) {
	const signinData = {
		__rvfInternalFormId: "signIn",
		anonymousId: "",
		username: username,
		password: password,
		url: "https://m.betking.com/my-accounts/login?urlAfterLogin=/",
		signedInUrl: "https://m.betking.com/my-accounts/login",
		location: "/",
		action: ""
	};

	const browser = getBrowserInstance();
	let page;

	try {
		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on('request', (req) => {
			const resourceType = req.resourceType();
			if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
				req.abort();
			} else {
				req.continue();
			}
		});

		// Navigate to login page with increased timeout
		await page.goto(signinData.url, { waitUntil: 'load', timeout: 30000 });

		// Fill login form
		await page.waitForSelector('#username', { timeout: 10000 }).catch(() => {
			throw new Error('Username field not found. Verify selector.');
		});
		await page.type('#username', signinData.username);

		await page.waitForSelector('#password', { timeout: 10000 }).catch(() => {
			throw new Error('Password field not found. Verify selector.');
		});
		await page.type('#password', signinData.password);

		// Enter key: 
		await page.keyboard.press('Enter');

		// check if successfully logged in
		await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 });
		if (page.url() === signinData.signedInUrl) {
			console.log(`[Bookmaker] Logged in ${username}`)
		} else {
			throw new Error(`[Bookmaker] Login failed ${username}`);
		}

		// Capture cookies
		const cookies = await page.cookies();
		await saveCookies(username, cookies);

		return {
			success: true,
			cookies: cookies,
		};

	} catch (error) {
		console.error(`[Bookmaker] Error logging in to ${signinData.url}:`, error.message);
		return { success: false, error: error.message };
	}
}

export async function getAccountInfo(username) {
	const cookies = await loadCookies(username);
	if (!cookies || cookies.length === 0) {
		throw new AuthenticationError('No saved cookies found.');
	}
	if (!await areCookiesValid(cookies)) {
		throw new AuthenticationError('Cookies have expired.');
	}

	const browser = getBrowserInstance();
	let page;

	try {
		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on('request', (req) => {
			if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
				req.abort();
			} else {
				req.continue();
			}
		});

		// 2. Set cookies and navigate to a page
		await browser.setCookie(...cookies);
		await page.setJavaScriptEnabled(false);
		await page.goto('https://m.betking.com', { waitUntil: 'domcontentloaded' });

		// 3. Find the astro-island element and get its props
		const headerIsland = await page.waitForSelector('astro-island[component-export="Header"]');
		if (!headerIsland) throw new Error("Could not find the header's astro-island element.");

		const propsString = await page.$eval(
			'astro-island[component-export="Header"]',
			(island) => island.getAttribute('props')
		);
		if (!propsString) throw new Error("Could not find the props attribute.");

		// 4. Parse the JSON to get the full data object
		const props = JSON.parse(propsString, (key, value) => {
			if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
				return value[1];
			}
			return value;
		});

		// 5. Return a comprehensive object with all the useful account info
		if (props.balance !== undefined) {
			const accountInfo = {
				balance: parseFloat(props.balance),
				accessToken: props.accessToken,
				freeBets: props.freeBets,
				unreadMessageCount: props.unreadMessageCount,
				isAuth: props.auth
			};
			console.log(`[Bookmaker] Successfully extracted account info for ${username}`);
			return accountInfo;
		} else {
			throw new Error('Account info (balance) not found in props object.');
		}

	} catch (error) {
		console.error(`[Bookmaker] Error getting account info:`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}

export async function placeBet(username, data) {
	const browser = getBrowserInstance();
	let page;

	try {
		console.log('[Bookmaker] Starting place bet process for', username);

		const cookies = await loadCookies(username);
		if (!cookies.length) {
			throw new AuthenticationError('No cookies found.');
		}
		if (!await areCookiesValid(cookies)) {
			throw new AuthenticationError('Cookies are expired.');
		}

		page = await browser.newPage();
		await page.setRequestInterception(true);
		page.on('request', (req) => {
			if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
				req.abort();
			} else {
				req.continue();
			}
		});

		await browser.setCookie(...cookies);

		console.log('[Bookmaker] Navigating to betslip page to acquire session data...');
		await page.goto('https://m.betking.com/sports/betslip', { waitUntil: 'domcontentloaded', timeout: 60000 });

		console.log('[Bookmaker] Waiting for page to be ready...');
		await page.waitForSelector('[id*="islandsToolbar"]', { timeout: 15000 });

		const result = await page.evaluate(async (dataToPost) => {
			// 1. Find the <astro-island> element that contains the header data.
			const headerIsland = document.querySelector('astro-island[component-export="Header"]');
			if (!headerIsland) {
				return { error: true, status: 500, text: "Could not find the header's astro-island element." };
			}

			// 2. Parse the 'props' attribute to get the session data.
			let accessToken = null;
			try {
				const propsString = headerIsland.getAttribute('props');
				const props = JSON.parse(propsString, (key, value) => {
					if (Array.isArray(value) && typeof value[1] !== 'undefined') {
						return value[1];
					}
					return value;
				});
				accessToken = props.accessToken;
			} catch (e) {
				return { error: true, status: 500, text: `Failed to parse props from astro-island: ${e.message}` };
			}

			if (!accessToken) {
				return { error: true, status: 500, text: "Could not find accessToken in the header's props." };
			}

			const apiUrl = "https://m.betking.com/sports/action/placebet?_data=routes%2F%28%24locale%29.sports.action.placebet";
			const bodyPayload = new URLSearchParams();
			bodyPayload.append('data', JSON.stringify(dataToPost));

			// 3. Add the required Authorization header to the request.
			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
				'Referer': 'https://m.betking.com/sports/betslip',
				'Authorization': `Bearer ${accessToken}`, // This header is critical
			};

			const response = await fetch(apiUrl, {
				method: "PUT",
				headers: headers,
				body: bodyPayload
			});

			const responseText = await response.text();

			if (!response.ok) {
				return { error: true, status: response.status, text: responseText };
			}
			if (!responseText) {
				return { error: true, status: 200, text: "Server returned an empty successful response." };
			}
			try {
				return JSON.parse(responseText);
			} catch (e) {
				return { error: true, status: 200, text: `Failed to parse JSON: ${responseText}` };
			}
		}, data);

		if (result.error) {
			throw new Error(`Bet placement failed with status ${result.status}: ${result.text}`);
		}

		if (result.responseStatus === 54) {
			throw new Error(`Bet rejected: Stake is lower than the amount allowed. (Status: 54)`);
		}

		if (result.responseStatus === 16) {
			throw new Error(`Bet rejected: Insufficient balance. (Status: 16)`);
		}

		if (result.responseStatus !== 1 || result.errorsList) {
			const errorMessage = result.errorsList ? JSON.stringify(result.errorsList) : 'Unknown reason';
			throw new Error(`Bet was rejected by the server. Status: ${result.responseStatus}, Errors: ${errorMessage}`);
		}

		console.log('[Bookmaker] Bet placed successfully:', result);
		return result;

	} catch (error) {
		if (error instanceof AuthenticationError) {
			throw error;
		}
		console.error('[Bookmaker] Error in placeBet:', error.message);
		if (page) {
			await page.screenshot({ path: `placebet_error_${Date.now()}.png` });
		}
		throw error;
	} finally {
		if (page) {
			await page.close();
		}
	}
}

export function constructBetPayload(matchData, market, selection, stakeAmount, providerData) {
	const totalOdds = selection.odd.value;
	const potentialWinnings = stakeAmount * totalOdds;
	const eventCategory = sportIdMapper[providerData.sportId] || 'F';

	const oddsSelection = {
		IDSelectionType: selection.typeId,
		IDSport: matchData.sportId,
		allowFixed: false,
		compatibilityLevel: 0,
		eventCategory: eventCategory,
		eventDate: matchData.date,
		eventId: matchData.id,
		eventName: matchData.categoryName,
		fixed: false,
		gamePlay: 1,
		incompatibleEvents: [],
		isExpired: false,
		isLocked: false,
		isBetBuilder: false,
		marketId: market.id,
		marketName: market.name,
		marketTag: 0,
		marketTypeId: market.typeId,
		matchId: matchData.id,
		matchName: matchData.name,
		oddValue: selection.odd.value,
		parentEventId: matchData.id,
		selectionId: selection.id,
		selectionName: selection.name,
		selectionNoWinValues: [],
		smartCode: matchData.smartBetCode,
		specialValue: selection.specialValue || "0",
		sportName: matchData.sportName,
		tournamentId: matchData.tournamentId,
		tournamentName: matchData.tournamentName
	};

	const grouping = {
		grouping: 1,
		combinations: 1,
		minWin: potentialWinnings,
		minWinNet: potentialWinnings,
		netStakeMinWin: potentialWinnings,
		maxWin: potentialWinnings,
		maxWinNet: potentialWinnings,
		netStakeMaxWin: potentialWinnings,
		minBonus: 0,
		maxBonus: 0,
		minPercentageBonus: 0,
		maxPercentageBonus: 0,
		stake: stakeAmount,
		netStake: stakeAmount,
		selected: true
	};

	const betCoupon = {
		isClientSideCoupon: true,
		couponTypeId: 1,
		minWin: potentialWinnings,
		minWinNet: potentialWinnings,
		netStakeMinWin: potentialWinnings,
		maxWin: potentialWinnings,
		maxWinNet: potentialWinnings,
		netStakeMaxWin: potentialWinnings,
		minBonus: 0,
		maxBonus: 0,
		minPercentageBonus: 0,
		maxPercentageBonus: 0,
		minOdd: totalOdds,
		maxOdd: totalOdds,
		totalOdds: totalOdds,
		stake: stakeAmount,
		useGroupsStake: false,
		stakeGross: stakeAmount,
		stakeTaxed: 0,
		taxPercentage: 0,
		tax: 0,
		minWithholdingTax: 0,
		maxWithholdingTax: 0,
		turnoverTax: 0,
		totalCombinations: 1,
		odds: [oddsSelection],
		groupings: [grouping],
		allGroupings: [grouping],
		possibleMissingGroupings: [],
		currencyId: 16,
		isLive: false,
		isVirtual: false,
		currentEvalMotivation: 0,
		betCouponGlobalVariable: {
			"currencyId": 16,
			"defaultStakeGross": 100,
			"isFreeBetRedemptionEnabled": false,
			"isVirtualsInstallation": false,
			"maxBetStake": 175438596.49,
			"maxCombinationBetWin": 75000000,
			"maxCombinationsByGrouping": 10000,
			"maxCouponCombinations": 17543859,
			"maxGroupingsBetStake": 41641682,
			"maxMultipleBetWin": 75000000,
			"maxNoOfEvents": 40,
			"maxNoOfSelections": 40,
			"maxSingleBetWin": 75000000,
			"minBetStake": 10,
			"minBonusOdd": 1.35,
			"minFlexiCutOdds": 1.01,
			"minFlexiCutSelections": 5,
			"minGroupingsBetStake": 5,
			"stakeInnerMod0Combination": 0.01,
			"stakeMod0Multiple": 0,
			"stakeMod0Single": 0,
			"stakeThresholdMultiple": 175438.6,
			"stakeThresholdSingle": 17543.86,
			"flexiCutGlobalVariable": {
				"parameters": {
					"formulaId": 1,
					"minOddThreshold": 1.05,
					"minWinningSelections": 2
				}
			}
		},
		language: "en",
		hasLive: false,
		couponType: 1,
	};

	return {
		betCoupon,
		allowOddChanges: true,
		allowStakeReduction: false,
		requestTransactionId: Date.now().toString(),
		transferStakeFromAgent: false
	};
};


