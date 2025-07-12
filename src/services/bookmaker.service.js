import Fuse from 'fuse.js';
import { getBrowserInstance } from '../core/browser.js';
import { writeFile } from "fs/promises"

// --- INTERNAL HELPER FUNCTIONS ---

/**
 * Helper 1: Fetches data from a direct JSON API endpoint.
 * @param {string} url The API URL to fetch.
 * @returns {Promise<object|null>}
 */
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
		console.error(`[Bookmaker Service] Error fetching API URL ${url}:`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}

async function _fetchJsonFromPage(url) {
	const browser = getBrowserInstance();
	let page;
	try {
		page = await browser.newPage();
		await page.goto(url, { waitUntil: 'networkidle2' });
		const content = await page.content();
		try {
			await writeFile('content.html', content);
			console.log('✅ File written successfully');
		} catch (err) {
			console.error('❌ Error writing file:', err);
		}


		const frames = page.frames();
for (const frame of frames) {
	const scripts = await frame.evaluate(() => Array.from(document.scripts).map(s => s.src));
	console.log(`Frame ${frame.url()} scripts:`, scripts);
}
		// This function runs inside the browser to find the correct script tag.
		const remixContextData = await page.evaluate(() => {
			// 1. Get ALL script tags on the page.
			const scripts = Array.from(document.querySelectorAll('script'));

			// 2. Find the specific script that contains our data object.
			const contextScript = scripts.find(script => script.textContent.includes('window.__remixContext'));

			// 3. If no script is found, we cannot proceed.
			if (!contextScript) {
				return null;
			}

			// 4. Extract just the JSON part from the script's text content.
			const scriptText = contextScript.textContent;
			const jsonText = scriptText.substring(
				scriptText.indexOf('{'),
				scriptText.lastIndexOf('}') + 1
			);

			// 5. Parse the JSON text into an object.
			try {
				return JSON.parse(jsonText);
			} catch (e) {
				return null;
			}
		});

		if (!remixContextData) {
			throw new Error('Could not find or parse __remixContext script tag on the page.');
		}

		// 6. Navigate through the complex object to find the event data.
		const loaderData = remixContextData?.state?.loaderData;
		if (!loaderData) throw new Error('loaderData not found in Remix context.');

		const routeKey = Object.keys(loaderData).find(key => key.includes('.sports.prematch.'));
		if (!routeKey) throw new Error('Event route key not found in loaderData.');

		const eventData = loaderData[routeKey]?.event;
		if (!eventData) return null;

		// 7. Remap the extracted data to the consistent format our bot expects.
		return {
			IDEvent: eventData.id,
			EventName: eventData.name,
			TeamHome: eventData.name.split(' - ')[0].trim(),
			TeamAway: eventData.name.split(' - ')[1].trim(),
			EventDate: eventData.date,
			Markets: eventData.markets.map(market => ({
				OddsID: market.id,
				OddsType: {
					OddsTypeID: market.typeId,
					OddsTypeName: market.name,
					OddsDescription: market.oddsDescription,
				},
				Markets: market.selections.map(sel => ({
					OddAttribute: {
						OddName: sel.name,
						SpecialValue: sel.specialValue,
					},
					OddOutcome: sel.odd.value
				}))
			}))
		};

	} catch (error) {
		console.error(`[Bookmaker Service] Error extracting Remix JSON on page ${url}:`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}

function normalizeTeamName(name) {
	if (!name) return '';
	// Split on spaces, slashes, hyphens
	const parts = name.toLowerCase().split(/[ \/-]/).filter(part => part);
	console.log(`[Bookmaker Service] Normalizing "${name}" -> parts: ${JSON.stringify(parts)}`);

	// Trim parts <=3 chars from front and rear, except youth indicators
	const keywordExceptions = ['u20', 'u19', 'u21', 'u23'];
	let start = 0;
	let end = parts.length;

	while (start < end && parts[start].length <= 3 && !keywordExceptions.includes(parts[start])) {
		start++;
	}

	while (end > start && parts[end - 1].length <= 3 && !keywordExceptions.includes(parts[end - 1])) {
		end--;
	}

	let meaningfulParts = parts.slice(start, end);
	console.log(`[Bookmaker Service] After trimming short parts: ${JSON.stringify(meaningfulParts)}`);

	// If no meaningful parts remain, use the longest original part
	if (!meaningfulParts.length) {
		meaningfulParts = [parts.reduce((longest, part) => part.length > longest.length ? part : longest, '')];
		console.log(`[Bookmaker Service] No meaningful parts, using longest: "${meaningfulParts[0]}"`);
	}

	// Remove specific keywords
	const keywordIncludes = ['club', 'deportivo', 'real', 'santa'];
	if (keywordIncludes.length > 0) {
		meaningfulParts = meaningfulParts.filter(part => !keywordIncludes.includes(part));
		console.log(`[Bookmaker Service] After removing keywords: ${JSON.stringify(meaningfulParts)}`);
	}

	// Join parts and clean up
	let normalized = meaningfulParts.join(' ');
	normalized = normalized.replace(/[.-]/g, ' ');
	normalized = normalized.replace(/\s+/g, ' ');
	normalized = normalized.trim();

	// Fallback if empty
	if (!normalized) {
		normalized = parts.reduce((longest, part) => part.length > longest.length ? part : longest, '');
		console.log(`[Bookmaker Service] Empty after processing, using longest part: "${normalized}"`);
	}

	console.log(`[Bookmaker Service] Final normalized name: "${normalized}"`);
	return normalized;
}
/**
 * Helper 3: Normalizes a team name for better fuzzy matching.
 */
// function normalizeTeamName(name) {
// 	if (!name) return '';
// 	let normalized = name.toLowerCase().split('/')[0];
// 	const keywords = ['fc', 'sc', 'cf', 'ac', 'as', 'cd', 'ca', 'rc', 'fk', 'sk', 'tsg', 'vfl', 'vfr', 'tsv', 'spvgg', 'gsk', 'ia', 'kr', 'bk', 'if', 'ifk', 'ff', 'club', 'rj', 'cs', 'st', 'una', 'fr', 'ii', 'iii', 'b', 'c', 'ec'];
// 	// Match keywords anywhere, surrounded by optional spaces or boundaries
// 	const keywordRegex = new RegExp(`\\b(?:${keywords.join('|')})\\b`, 'g');
// 	normalized = normalized.replace(keywordRegex, '');
// 	normalized = normalized.replace(/[.-]/g, ' ');
// 	normalized = normalized.replace(/\s+/g, ' ');
// 	return normalized.trim();
// }
/**
 * Helper 4: Creates a URL-friendly slug from an event name.
 */
function _slugifyEventName(name) {
	if (!name) return '';
	return name.toLowerCase()
		.replace(/ & /g, ' and ')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}


// --- EXPORTABLE SERVICE FUNCTIONS ---

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

/**
 * Finds the best preliminary match for a team pair using fuzzy search.
 * This is the first step to get the correct IDEvent and EventName.
 */
// export async function getBetKingMatchDataByTeamPair(home, away) {
// 	if (!home || !away) { return null; }
// 	const normalizedHome = normalizeTeamName(home);
// 	const normalizedAway = normalizeTeamName(away);
// 	console.log(`[Bookmaker Service] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);
// 	try {
// 		const searchTerm = normalizedHome.length < normalizedAway.length ? home : away;
// 		// const matches = await getBetKingTeamDataByName(searchTerm);
// 		// if (!matches || !matches.length) { return null; }
// 		const matches = await getBetKingTeamDataByName(searchTerm);
// 		console.log(`[Bookmaker Service] Raw API response for "${searchTerm}":`, matches);
// 		if (!matches || !matches.length) {
// 			console.log(`[Bookmaker Service] No matches found for "${searchTerm}"`);
// 			return null;
// 		}
//
// 		const searchableMatches = matches.map(match => ({ ...match, normalizedHome: normalizeTeamName(match.TeamHome), normalizedAway: normalizeTeamName(match.TeamAway) }));
// 		const fuse = new Fuse(searchableMatches, { includeScore: true, threshold: 0.8, keys: [{ name: 'normalizedHome', weight: 0.5 }, { name: 'normalizedAway', weight: 0.5 }] });
// 		const results = fuse.search({ $and: [{ $or: [{ normalizedHome: normalizedHome }, { normalizedAway: normalizedHome }] }, { $or: [{ normalizedHome: normalizedAway }, { normalizedAway: normalizedAway }] }] });
//
// 		if (results.length === 0) { return null; }
// 		const bestMatch = results[0];
// 		if (bestMatch.score > 0.5) {
// 			console.log(`[Bookmaker Service] Match for "${home} vs ${away}" rejected. Score (${bestMatch.score.toFixed(4)}) too high.`);
// 			return null;
// 		}
// 		console.log(`[Bookmaker Service] Found preliminary match with score ${bestMatch.score.toFixed(4)}: "${bestMatch.item.TeamHome} vs ${bestMatch.item.TeamAway}"`);
// 		return bestMatch.item;
// 	} catch (error) {
// 		console.error(`[Bookmaker Service] Error in getBetKingMatchDataByTeamPair:`, error.message);
// 		return null;
// 	}
// }

// export async function getBetKingMatchDataByTeamPair(home, away) {
//     if (!home || !away) { return null; }
//     const normalizedHome = normalizeTeamName(home);
//     const normalizedAway = normalizeTeamName(away);
//     console.log(`[Bookmaker Service] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);
//
//     try {
//         const searchTerm = normalizedHome.length < normalizedAway.length ? home : away;
//         const matches = await getBetKingTeamDataByName(searchTerm);
//         console.log(`[Bookmaker Service] Raw API response for "${searchTerm}":`, matches);
//         if (!matches || !matches.length) {
//             console.log(`[Bookmaker Service] No matches found for "${searchTerm}"`);
//             return null;
//         }
//
//         const searchableMatches = matches.map(match => ({
//             ...match,
//             normalizedHome: normalizeTeamName(match.TeamHome),
//             normalizedAway: normalizeTeamName(match.TeamAway)
//         }));
//
//         const fuse = new Fuse(searchableMatches, {
//             includeScore: true,
//             threshold: 0.8,
//             keys: [
//                 { name: 'normalizedHome', weight: 0.5 },
//                 { name: 'normalizedAway', weight: 0.5 }
//             ]
//         });
//
//         // Search for matches where both teams are close
//         const results = fuse.search({
//             $and: [
//                 { normalizedHome: normalizedHome },
//                 { normalizedAway: normalizedAway }
//             ]
//         });
//
//         console.log(`[Bookmaker Service] Fuzzy search results for "${home} vs ${away}":`, results.map(r => ({
//             score: r.score,
//             eventName: r.item.EventName,
//             normalizedHome: r.item.normalizedHome,
//             normalizedAway: r.item.normalizedAway
//         })));
//
//         if (results.length === 0) {
//             console.log(`[Bookmaker Service] No fuzzy matches found for "${home} vs ${away}"`);
//             return null;
//         }
//
//         // Iterate through results to find a suitable match
//         for (const result of results) {
//             if (result.score <= 0.5) {
//                 console.log(`[Bookmaker Service] Found preliminary match with score ${result.score.toFixed(4)}: "${result.item.EventName}"`);
//                 return result.item;
//             }
//             console.log(`[Bookmaker Service] Match "${result.item.EventName}" rejected. Score (${result.score.toFixed(4)}) too high.`);
//         }
//
//         console.log(`[Bookmaker Service] No suitable match found for "${home} vs ${away}"`);
//         return null;
//     } catch (error) {
//         console.error(`[Bookmaker Service] Error in getBetKingMatchDataByTeamPair:`, error.message);
//         return null;
//     }
// }
// export async function getBetKingMatchDataByTeamPair(home, away) {
//     if (!home || !away) { return null; }
//     const normalizedHome = normalizeTeamName(home);
//     const normalizedAway = normalizeTeamName(away);
//     console.log(`[Bookmaker Service] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);
//
//     async function searchMatches(searchTerm) {
//         const matches = await getBetKingTeamDataByName(searchTerm);
//         console.log(`[Bookmaker Service] Raw API response for "${searchTerm}":`, matches);
//         if (!matches || !matches.length) {
//             console.log(`[Bookmaker Service] No matches found for "${searchTerm}"`);
//             return [];
//         }
//         return matches.map(match => ({
//             ...match,
//             normalizedHome: normalizeTeamName(match.TeamHome),
//             normalizedAway: normalizeTeamName(match.TeamAway)
//         }));
//     }
//
//     try {
//         // Try searching with both teams
//         let searchableMatches = await searchMatches(home);
//         if (!searchableMatches.length) {
//             searchableMatches = await searchMatches(away);
//         }
//
//         if (!searchableMatches.length) {
//             console.log(`[Bookmaker Service] No matches found for either "${home}" or "${away}"`);
//             return null;
//         }
//
//         const fuse = new Fuse(searchableMatches, {
//             includeScore: true,
//             threshold: 0.4, // Stricter threshold
//             keys: [
//                 { name: 'normalizedHome', weight: 0.8 }, // Higher home team weight
//                 { name: 'normalizedAway', weight: 0.2 }
//             ]
//         });
//
//         // Try home/away and away/home combinations
//         const results = [
//             ...fuse.search({
//                 $and: [
//                     { normalizedHome: normalizedHome },
//                     { normalizedAway: normalizedAway }
//                 ]
//             }),
//             ...fuse.search({
//                 $and: [
//                     { normalizedHome: normalizedAway },
//                     { normalizedAway: normalizedHome }
//                 ]
//             })
//         ].sort((a, b) => a.score - b.score); // Sort by score ascending
//
//         console.log(`[Bookmaker Service] Fuzzy search results for "${home} vs ${away}":`, results.map(r => ({
//             score: r.score,
//             eventName: r.item.EventName,
//             normalizedHome: r.item.normalizedHome,
//             normalizedAway: r.item.normalizedAway
//         })));
//
//         if (results.length === 0) {
//             console.log(`[Bookmaker Service] No fuzzy matches found for "${home} vs ${away}"`);
//             return null;
//         }
//
//         // Log individual scores for debugging
//         const bestResult = results[0];
//         const homeScore = fuse.search({ normalizedHome: normalizedHome })[0]?.score || 'N/A';
//         const awayScore = fuse.search({ normalizedAway: normalizedAway })[0]?.score || 'N/A';
//         console.log(`[Bookmaker Service] Home team score: ${homeScore}, Away team score: ${awayScore}`);
//
//         // Stricter score cutoff
//         if (bestResult.score <= 0.3) {
//             console.log(`[Bookmaker Service] Found preliminary match with score ${bestResult.score.toFixed(4)}: "${bestResult.item.EventName}"`);
//             return bestResult.item;
//         }
//
//         console.log(`[Bookmaker Service] No suitable match found. Best score (${bestResult.score.toFixed(4)}) too high.`);
//         return null;
//     } catch (error) {
//         console.error(`[Bookmaker Service] Error in getBetKingMatchDataByTeamPair:`, error.message);
//         return null;
//     }
// }
export async function getBetKingMatchDataByTeamPair(home, away) {
	if (!home || !away) { return null; }
	const normalizedHome = normalizeTeamName(home);
	const normalizedAway = normalizeTeamName(away);
	console.log(`[Bookmaker Service] Normalized Search: "${normalizedHome}" vs "${normalizedAway}"`);

	async function searchMatches(searchTerm) {
		const matches = await getBetKingTeamDataByName(searchTerm);
		console.log(`[Bookmaker Service] Raw API response for "${searchTerm}":`, matches);
		if (!matches || !matches.length) {
			console.log(`[Bookmaker Service] No matches found for "${searchTerm}"`);
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
			console.log(`[Bookmaker Service] No matches found for either "${home}" or "${away}"`);
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

		console.log(`[Bookmaker Service] Fuzzy search results for "${home} vs ${away}":`, results.map(r => ({
			score: r.score,
			eventName: r.item.EventName,
			normalizedHome: r.item.normalizedHome,
			normalizedAway: r.item.normalizedAway,
			isHomeAway: r.isHomeAway
		})));

		if (results.length === 0) {
			console.log(`[Bookmaker Service] No fuzzy matches found for "${home} vs ${away}"`);
			return null;
		}

		// Log individual scores for debugging
		const bestResult = results[0];
		const homeScore = fuse.search({ normalizedHome: normalizedHome })[0]?.score || 'N/A';
		const awayScore = fuse.search({ normalizedAway: normalizedAway })[0]?.score || 'N/A';
		console.log(`[Bookmaker Service] Home team score: ${homeScore}, Away team score: ${awayScore}`);

		// Stricter score cutoff and check individual scores
		if (bestResult.score <= 0.25 && homeScore <= 0.4 && awayScore <= 0.4) {
			console.log(`[Bookmaker Service] Found preliminary match with score ${bestResult.score.toFixed(4)}: "${bestResult.item.EventName}" (Home/Away: ${bestResult.isHomeAway})`);
			return bestResult.item;
		}

		console.log(`[Bookmaker Service] No suitable match found. Best score (${bestResult.score.toFixed(4)}), Home score (${homeScore}), Away score (${awayScore})`);
		return null;
	} catch (error) {
		console.error(`[Bookmaker Service] Error in getBetKingMatchDataByTeamPair:`, error.message);
		return null;
	}
}

export async function getBetKingMatchDetailsByEvent(eventId, eventName) {
	if (!eventId || !eventName) return null;
	const eventSlug = _slugifyEventName(eventName);
	const url = `https://m.betking.com/sports/prematch/${eventId}/${eventSlug}`;
	console.log(`[Bookmaker Service] Fetching and parsing data from page: ${url}`);
	return _fetchJsonFromPage(url);
}
