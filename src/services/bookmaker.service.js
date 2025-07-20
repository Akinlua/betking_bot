import Fuse from 'fuse.js';
import { getBrowserInstance } from '../core/browser.js';
import fs from "fs/promises";
import path from 'path';
import { URLSearchParams } from 'url';

async function loadCookies(username) {
	const cookiePath = path.resolve(`data/cookies/${username}-cookies.json`);
	try {
		const cookieData = await fs.readFile(cookiePath, 'utf8');
		return JSON.parse(cookieData);
	} catch (error) {
		return [];
	}
}

async function saveCookies(username, cookies) {
	const cookiePath = path.resolve(`./data/cookies/${username}-cookies.json`);
	await fs.mkdir(path.dirname(cookiePath), { recursive: true });
	await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));
}

async function areCookiesValid(cookies) {
	const accessToken = cookies.find(c => c.name === 'accessToken');
	if (!accessToken) {
		console.log('[Bookmaker] No accessToken cookie found');
		return false;
	}
	const now = Math.floor(Date.now() / 1000); // Current time in seconds
	if (accessToken.expires && accessToken.expires < now) {
		console.log('[Bookmaker] accessToken cookie expired');
		return false;
	}
	console.log('[Bookmaker] accessToken cookie is valid until', new Date(accessToken.expires * 1000));
	return true;
}

async function _fetchJsonFromApi(url) {
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
		const response = await page.goto(url, { waitUntil: 'networkidle2' });
		if (!response.ok()) {
			throw new Error(`Request failed with status: ${response.status()}`);
		}
		let res = await response.json();
		return res;
	} catch (error) {
		console.error(`[Bookmaker] Error fetching API URL ${url}:`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}


function normalizeTeamName(name) {
	if (!name) return '';
	// Split on spaces, slashes, hyphens
	const parts = name.toLowerCase().split(/[ \/-]/).filter(part => part);
	// console.log(`[Bookmaker] Normalizing "${name}" -> parts: ${JSON.stringify(parts)}`);

	// Trim parts <=3 chars from front and rear, except youth indicators
	let start = 0;
	let end = parts.length;

	while (start < end && parts[start].length < 3) {
		start++;
	}

	while (end > start && parts[end - 1].length < 3) {
		end--;
	}

	let meaningfulParts = parts.slice(start, end);
	// console.log(`[Bookmaker] After trimming short parts: ${JSON.stringify(meaningfulParts)}`);

	// If no meaningful parts remain, use the longest original part
	if (!meaningfulParts.length) {
		meaningfulParts = [parts.reduce((longest, part) => part.length > longest.length ? part : longest, '')];
		// console.log(`[Bookmaker] No meaningful parts, using longest: "${meaningfulParts[0]}"`);
	}

	// Remove specific keywords
	// const keywordIncludes = ['club', 'deportivo', 'real', 'santa'];
	// if (keywordIncludes.length > 0) {
	// 	meaningfulParts = meaningfulParts.filter(part => !keywordIncludes.includes(part));
	// 	// console.log(`[Bookmaker] After removing keywords: ${JSON.stringify(meaningfulParts)}`);
	// }

	// Join parts and clean up
	let normalized = meaningfulParts.join(' ');
	normalized = normalized.replace(/[.-]/g, ' ');
	normalized = normalized.replace(/\s+/g, ' ');
	normalized = normalized.trim();

	// // Fallback if empty
	// if (!normalized) {
	// 	normalized = parts.reduce((longest, part) => part.length > longest.length ? part : longest, '');
	// 	// console.log(`[Bookmaker] Empty after processing, using longest part: "${normalized}"`);
	// }

	console.log(`[Bookmaker] Final normalized name: "${normalized}"`);
	return normalized;
}

function _slugifyEventName(name) {
	if (!name) return '';
	return name.toLowerCase()
		.replace(/ & /g, ' and ')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}


/**
 * Fetches basic match data from the API by its numeric ID.
 */
export async function getBetKingTeamDataById(matchId) {
	if (!matchId || typeof matchId !== 'string') return null;
	const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Match/${matchId}`;
	return _fetchJsonFromApi(url);
}

/**
 * Fetches a list of potential matches from the search API.
 */
export async function getBetKingTeamDataByName(searchTerm) {
	if (!searchTerm || typeof searchTerm !== 'string') return null;
	const formattedSearchTerm = encodeURIComponent(searchTerm.trim());
	const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Search/lang/en?search=${formattedSearchTerm}`;
	const data = await _fetchJsonFromApi(url);
	if (!data) return null;
	const matches = Array.isArray(data) ? data : data.matches || data.results || [];
	return Array.isArray(matches) ? matches : [matches];
}

export async function getBetKingMatchDataByTeamPair(home, away) {
	if (!home || !away) { return null; }
	const normalizedHome = normalizeTeamName(home);
	const normalizedAway = normalizeTeamName(away);
	console.log(`[Bookmaker] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);

	async function searchMatches(searchTerm) {
		const matches = await getBetKingTeamDataByName(searchTerm);
		console.log(`[Bookmaker] Raw API response for "${searchTerm}":`, matches);
		if (!matches || !matches.length) {
			console.log(`[Bookmaker] No matches found for "${searchTerm}"`);
			return [];
		}
		return matches.map(match => ({
			...match,
			normalizedHome: normalizeTeamName(match.TeamHome),
			normalizedAway: normalizeTeamName(match.TeamAway)
		}));
	}

	try {
		// Search with both teams
		let searchableMatches = await searchMatches(home);
		if (!searchableMatches.length) {
			searchableMatches = await searchMatches(away);
		}

		if (!searchableMatches.length) {
			console.log(`[Bookmaker] No matches found for either "${home}" or "${away}"`);
			return null;
		}

		const fuse = new Fuse(searchableMatches, {
			includeScore: true,
			threshold: 0.3, // Even stricter threshold
			keys: [
				{ name: 'normalizedHome', weight: 0.6 },
				{ name: 'normalizedAway', weight: 0.4 }
			]
		});

		// Search both home/away and away/home combinations
		const results = [
			...fuse.search({
				$and: [
					{ normalizedHome: normalizedHome },
					{ normalizedAway: normalizedAway }
				]
			}).map(result => ({ ...result, isHomeAway: true })),
			...fuse.search({
				$and: [
					{ normalizedHome: normalizedAway },
					{ normalizedAway: normalizedHome }
				]
			}).map(result => ({ ...result, isHomeAway: false }))
		].sort((a, b) => a.score - b.score);

		console.log(`[Bookmaker] Fuzzy search results for "${home} vs ${away}":`, results.map(r => ({
			score: r.score,
			eventName: r.item.EventName,
			normalizedHome: r.item.normalizedHome,
			normalizedAway: r.item.normalizedAway,
			isHomeAway: r.isHomeAway
		})));

		if (results.length === 0) {
			console.log(`[Bookmaker] No fuzzy matches found for "${home} vs ${away}"`);
			return null;
		}

		// Log individual scores for debugging
		const bestResult = results[0];
		const homeScore = fuse.search({ normalizedHome: normalizedHome })[0]?.score || 'N/A';
		const awayScore = fuse.search({ normalizedAway: normalizedAway })[0]?.score || 'N/A';
		console.log(`[Bookmaker] Home team score: ${homeScore}, Away team score: ${awayScore}`);

		// Stricter score cutoff and check individual scores
		if (bestResult.score <= 0.25 && homeScore <= 0.4 && awayScore <= 0.4) {
			console.log(`[Bookmaker] Found preliminary match with score ${bestResult.score.toFixed(4)}: "${bestResult.item.EventName}" (Home/Away: ${bestResult.isHomeAway})`);
			return bestResult.item;
		}

		console.log(`[Bookmaker] No suitable match found. Best score (${bestResult.score.toFixed(4)}), Home score (${homeScore}), Away score (${awayScore})`);
		return null;
	} catch (error) {
		console.error(`[Bookmaker] Error in getBetKingMatchDataByTeamPair:`, error.message);
		return null;
	}
}

export async function getBetKingMatchDetailsByEvent(eventId, eventName) {
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

export async function placeBet(username, data) {
	const browser = getBrowserInstance();
	let page;

	try {
		console.log('[Bookmaker] Starting place bet process for', username);

		const cookies = await loadCookies(username);
		if (!cookies.length) throw new Error('No cookies found. Please sign in first.');
		if (!await areCookiesValid(cookies)) throw new Error('Cookies are expired. Please sign in again.');

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

		// console.log('[Bookmaker] Navigating to betslip page to acquire session data...');
		await page.goto('https://m.betking.com/sports/betslip', { waitUntil: 'load', timeout: 60000 });

		// Log page load confirmation
		// const pageContent = await page.content();
		const result = await page.evaluate(async (dataToPost) => {
			const apiUrl = "https://m.betking.com/sports/action/placebet?_data=routes%2F%28%24locale%29.sports.action.placebet";
			const bodyPayload = new URLSearchParams();
			bodyPayload.append('data', JSON.stringify(dataToPost));

			const headers = {
				'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
				'Referer': 'https://m.betking.com/sports/betslip',
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

		// A successful response has responseStatus: 1. Anything else is a failure.
		if (result.responseStatus !== 1 || result.errorsList) {
			const errorMessage = result.errorsList ? JSON.stringify(result.errorsList) : 'Unknown reason';
			throw new Error(`Bet was rejected by the server. Status: ${result.responseStatus}, Errors: ${errorMessage}`);
		}

		console.log('[Bookmaker] Bet placed successfully:', result);
		return result;

	} catch (error) {
		throw new Error(`[Bookmaker] Error in placeBet ${error.message}`);
	}
}
