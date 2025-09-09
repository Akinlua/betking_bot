import Fuse from 'fuse.js';
import { URLSearchParams } from 'url';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { AuthenticationError } from '../../../core/errors.js';

class BetKingBookmaker {
	constructor(config, browser) {
		this.config = config;
		this.browser = browser;
		this.state = {
			status: 'INITIALIZING',
			message: 'Bot has just started'
		};
		// Note: Sport IDs are defined for the provider's system.
		// - sportId=1: Football
		// - sportId=3: Basketball (provider); corresponds to bookmaker sportId=2
		this.sportIdMapper = {
			'1': 'F', // Football
			'3': 'B', // Basketball
		};

		this.lineTypeMapper = {
			"money_line": {
				name: "money_line",
				sport: {
					'1': { '*': { label: "1X2", outcome: { home: "1", draw: "X", away: "2" } } },
					'3': { '*': { label: "Moneyline", outcome: { home: "1", away: "2" } } }
				}
			},
			"totals": {
				name: "total",
				sport: {
					'1': { '*': { label: 'Total Goals', outcome: { over: "Over", under: "Under" } } },
					'3': { '*': { label: 'Total (Incl. Overtime)', outcome: { over: "Over", under: "Under" } } }
				}
			},
			"spreads": {
				name: "handicap",
				sport: {
					'1': {
						'*': { label: 'Handicap', outcome: { home: "Home", away: "Away" } },
						bridge: {
							// --- Positive Asian Handicaps (+ AH) --- CORRECT
							"0.5": { home: { specialValue: "1 : 0", outcome: "Home" }, away: { specialValue: "0 : 1", outcome: "Away" } },
							"1.5": { home: { specialValue: "2 : 0", outcome: "Home" }, away: { specialValue: "0 : 2", outcome: "Away" } },
							"2.5": { home: { specialValue: "3 : 0", outcome: "Home" }, away: { specialValue: "0 : 3", outcome: "Away" } },
							"3.5": { home: { specialValue: "4 : 0", outcome: "Home" }, away: { specialValue: "0 : 4", outcome: "Away" } },
							"4.5": { home: { specialValue: "5 : 0", outcome: "Home" }, away: { specialValue: "0 : 5", outcome: "Away" } },
							"5.5": { home: { specialValue: "6 : 0", outcome: "Home" }, away: { specialValue: "0 : 6", outcome: "Away" } },
							"6.5": { home: { specialValue: "7 : 0", outcome: "Home" }, away: { specialValue: "0 : 7", outcome: "Away" } },

							// --- Negative Asian Handicaps (- AH) --- CORRECTED
							"-1.5": { home: { specialValue: "0 : 1", outcome: "Home" }, away: { specialValue: "1 : 0", outcome: "Away" } },
							"-2.5": { home: { specialValue: "0 : 2", outcome: "Home" }, away: { specialValue: "2 : 0", outcome: "Away" } },
							"-3.5": { home: { specialValue: "0 : 3", outcome: "Home" }, away: { specialValue: "3 : 0", outcome: "Away" } },
							"-4.5": { home: { specialValue: "0 : 4", outcome: "Home" }, away: { specialValue: "4 : 0", outcome: "Away" } },
							"-5.5": { home: { specialValue: "0 : 5", outcome: "Home" }, away: { specialValue: "5 : 0", outcome: "Away" } },
							"-6.5": { home: { specialValue: "0 : 6", outcome: "Home" }, away: { specialValue: "6 : 0", outcome: "Away" } },

							// --- Special Cases --- CORRECT
							"0.0": {
								home: { marketName: "Draw No Bet", outcome: "1 DNB" },
								away: { marketName: "Draw No Bet", outcome: "2 DNB" }  // <-- CORRECTED
							},
						}
					},
					'3': {
						'*': { label: 'Handicap (Incl. Overtime)', outcome: { home: "1 AH", away: "2 AH" } },
						bridge: {
							// Negative Handicaps (-50.0 to -0.5)
							"1.5": { home: { specialValue: "1.5 : 0", outcome: "1 AH" }, away: { specialValue: "1.5 : 0", outcome: "2 AH" } },
							"2.5": { home: { specialValue: "2.5 : 0", outcome: "1 AH" }, away: { specialValue: "2.5 : 0", outcome: "2 AH" } },
							"3.5": { home: { specialValue: "3.5 : 0", outcome: "1 AH" }, away: { specialValue: "3.5 : 0", outcome: "2 AH" } },
							"4.5": { home: { specialValue: "4.5 : 0", outcome: "1 AH" }, away: { specialValue: "4.5 : 0", outcome: "2 AH" } },
							"5.5": { home: { specialValue: "5.5 : 0", outcome: "1 AH" }, away: { specialValue: "5.5 : 0", outcome: "2 AH" } },
							"6.5": { home: { specialValue: "6.5 : 0", outcome: "1 AH" }, away: { specialValue: "6.5 : 0", outcome: "2 AH" } },
							"7.5": { home: { specialValue: "7.5 : 0", outcome: "1 AH" }, away: { specialValue: "7.5 : 0", outcome: "2 AH" } },
							"8.5": { home: { specialValue: "8.5 : 0", outcome: "1 AH" }, away: { specialValue: "8.5 : 0", outcome: "2 AH" } },
							"9.5": { home: { specialValue: "9.5 : 0", outcome: "1 AH" }, away: { specialValue: "9.5 : 0", outcome: "2 AH" } },
							"10.5": { home: { specialValue: "10.5 : 0", outcome: "1 AH" }, away: { specialValue: "10.5 : 0", outcome: "2 AH" } },
							"11.5": { home: { specialValue: "11.5 : 0", outcome: "1 AH" }, away: { specialValue: "11.5 : 0", outcome: "2 AH" } },
							"12.5": { home: { specialValue: "12.5 : 0", outcome: "1 AH" }, away: { specialValue: "12.5 : 0", outcome: "2 AH" } },
							"13.5": { home: { specialValue: "13.5 : 0", outcome: "1 AH" }, away: { specialValue: "13.5 : 0", outcome: "2 AH" } },
							"14.5": { home: { specialValue: "14.5 : 0", outcome: "1 AH" }, away: { specialValue: "14.5 : 0", outcome: "2 AH" } },
							"15.5": { home: { specialValue: "15.5 : 0", outcome: "1 AH" }, away: { specialValue: "15.5 : 0", outcome: "2 AH" } },
							"16.5": { home: { specialValue: "16.5 : 0", outcome: "1 AH" }, away: { specialValue: "16.5 : 0", outcome: "2 AH" } },
							"17.5": { home: { specialValue: "17.5 : 0", outcome: "1 AH" }, away: { specialValue: "17.5 : 0", outcome: "2 AH" } },
							"18.5": { home: { specialValue: "18.5 : 0", outcome: "1 AH" }, away: { specialValue: "18.5 : 0", outcome: "2 AH" } },
							"19.5": { home: { specialValue: "19.5 : 0", outcome: "1 AH" }, away: { specialValue: "19.5 : 0", outcome: "2 AH" } },
							"20.5": { home: { specialValue: "20.5 : 0", outcome: "1 AH" }, away: { specialValue: "20.5 : 0", outcome: "2 AH" } },
							"21.5": { home: { specialValue: "21.5 : 0", outcome: "1 AH" }, away: { specialValue: "21.5 : 0", outcome: "2 AH" } },
							"22.5": { home: { specialValue: "22.5 : 0", outcome: "1 AH" }, away: { specialValue: "22.5 : 0", outcome: "2 AH" } },
							"23.5": { home: { specialValue: "23.5 : 0", outcome: "1 AH" }, away: { specialValue: "23.5 : 0", outcome: "2 AH" } },
							"24.5": { home: { specialValue: "24.5 : 0", outcome: "1 AH" }, away: { specialValue: "24.5 : 0", outcome: "2 AH" } },
							"25.5": { home: { specialValue: "25.5 : 0", outcome: "1 AH" }, away: { specialValue: "25.5 : 0", outcome: "2 AH" } },
							"26.5": { home: { specialValue: "26.5 : 0", outcome: "1 AH" }, away: { specialValue: "26.5 : 0", outcome: "2 AH" } },
							"27.5": { home: { specialValue: "27.5 : 0", outcome: "1 AH" }, away: { specialValue: "27.5 : 0", outcome: "2 AH" } },
							"28.5": { home: { specialValue: "28.5 : 0", outcome: "1 AH" }, away: { specialValue: "28.5 : 0", outcome: "2 AH" } },
							"29.5": { home: { specialValue: "29.5 : 0", outcome: "1 AH" }, away: { specialValue: "29.5 : 0", outcome: "2 AH" } },
							"30.5": { home: { specialValue: "30.5 : 0", outcome: "1 AH" }, away: { specialValue: "30.5 : 0", outcome: "2 AH" } },
							"31.5": { home: { specialValue: "31.5 : 0", outcome: "1 AH" }, away: { specialValue: "31.5 : 0", outcome: "2 AH" } },
							"32.5": { home: { specialValue: "32.5 : 0", outcome: "1 AH" }, away: { specialValue: "32.5 : 0", outcome: "2 AH" } },
							"33.5": { home: { specialValue: "33.5 : 0", outcome: "1 AH" }, away: { specialValue: "33.5 : 0", outcome: "2 AH" } },
							"34.5": { home: { specialValue: "34.5 : 0", outcome: "1 AH" }, away: { specialValue: "34.5 : 0", outcome: "2 AH" } },
							"35.5": { home: { specialValue: "35.5 : 0", outcome: "1 AH" }, away: { specialValue: "35.5 : 0", outcome: "2 AH" } },
							"36.5": { home: { specialValue: "36.5 : 0", outcome: "1 AH" }, away: { specialValue: "36.5 : 0", outcome: "2 AH" } },
							"37.5": { home: { specialValue: "37.5 : 0", outcome: "1 AH" }, away: { specialValue: "37.5 : 0", outcome: "2 AH" } },
							"38.5": { home: { specialValue: "38.5 : 0", outcome: "1 AH" }, away: { specialValue: "38.5 : 0", outcome: "2 AH" } },
							"39.5": { home: { specialValue: "39.5 : 0", outcome: "1 AH" }, away: { specialValue: "39.5 : 0", outcome: "2 AH" } },
							"40.5": { home: { specialValue: "40.5 : 0", outcome: "1 AH" }, away: { specialValue: "40.5 : 0", outcome: "2 AH" } },
							"41.5": { home: { specialValue: "41.5 : 0", outcome: "1 AH" }, away: { specialValue: "41.5 : 0", outcome: "2 AH" } },
							"42.5": { home: { specialValue: "42.5 : 0", outcome: "1 AH" }, away: { specialValue: "42.5 : 0", outcome: "2 AH" } },
							"43.5": { home: { specialValue: "43.5 : 0", outcome: "1 AH" }, away: { specialValue: "43.5 : 0", outcome: "2 AH" } },
							"44.5": { home: { specialValue: "44.5 : 0", outcome: "1 AH" }, away: { specialValue: "44.5 : 0", outcome: "2 AH" } },
							"45.5": { home: { specialValue: "45.5 : 0", outcome: "1 AH" }, away: { specialValue: "45.5 : 0", outcome: "2 AH" } },
							"46.5": { home: { specialValue: "46.5 : 0", outcome: "1 AH" }, away: { specialValue: "46.5 : 0", outcome: "2 AH" } },
							"47.5": { home: { specialValue: "47.5 : 0", outcome: "1 AH" }, away: { specialValue: "47.5 : 0", outcome: "2 AH" } },
							"48.5": { home: { specialValue: "48.5 : 0", outcome: "1 AH" }, away: { specialValue: "48.5 : 0", outcome: "2 AH" } },
							"49.5": { home: { specialValue: "49.5 : 0", outcome: "1 AH" }, away: { specialValue: "49.5 : 0", outcome: "2 AH" } },
							"50.0": { home: { specialValue: "50.0 : 0", outcome: "1 AH" }, away: { specialValue: "50.0 : 0", outcome: "2 AH" } },

							// --- Negative Handicaps (-0.5 to -50.0) ---
							"-0.5": { home: { specialValue: "0 : 0.5", outcome: "1 AH" }, away: { specialValue: "0 : 0.5", outcome: "2 AH" } },
							"-1.5": { home: { specialValue: "0 : 1.5", outcome: "1 AH" }, away: { specialValue: "0 : 1.5", outcome: "2 AH" } },
							"-2.5": { home: { specialValue: "0 : 2.5", outcome: "1 AH" }, away: { specialValue: "0 : 2.5", outcome: "2 AH" } },
							"-3.5": { home: { specialValue: "0 : 3.5", outcome: "1 AH" }, away: { specialValue: "0 : 3.5", outcome: "2 AH" } },
							"-4.5": { home: { specialValue: "0 : 4.5", outcome: "1 AH" }, away: { specialValue: "0 : 4.5", outcome: "2 AH" } },
							"-5.5": { home: { specialValue: "0 : 5.5", outcome: "1 AH" }, away: { specialValue: "0 : 5.5", outcome: "2 AH" } },
							"-6.5": { home: { specialValue: "0 : 6.5", outcome: "1 AH" }, away: { specialValue: "0 : 6.5", outcome: "2 AH" } },
							"-7.5": { home: { specialValue: "0 : 7.5", outcome: "1 AH" }, away: { specialValue: "0 : 7.5", outcome: "2 AH" } },
							"-8.5": { home: { specialValue: "0 : 8.5", outcome: "1 AH" }, away: { specialValue: "0 : 8.5", outcome: "2 AH" } },
							"-9.5": { home: { specialValue: "0 : 9.5", outcome: "1 AH" }, away: { specialValue: "0 : 9.5", outcome: "2 AH" } },
							"-10.5": { home: { specialValue: "0 : 10.5", outcome: "1 AH" }, away: { specialValue: "0 : 10.5", outcome: "2 AH" } },
							"-11.5": { home: { specialValue: "0 : 11.5", outcome: "1 AH" }, away: { specialValue: "0 : 11.5", outcome: "2 AH" } },
							"-12.5": { home: { specialValue: "0 : 12.5", outcome: "1 AH" }, away: { specialValue: "0 : 12.5", outcome: "2 AH" } },
							"-13.5": { home: { specialValue: "0 : 13.5", outcome: "1 AH" }, away: { specialValue: "0 : 13.5", outcome: "2 AH" } },
							"-14.5": { home: { specialValue: "0 : 14.5", outcome: "1 AH" }, away: { specialValue: "0 : 14.5", outcome: "2 AH" } },
							"-15.5": { home: { specialValue: "0 : 15.5", outcome: "1 AH" }, away: { specialValue: "0 : 15.5", outcome: "2 AH" } },
							"-16.5": { home: { specialValue: "0 : 16.5", outcome: "1 AH" }, away: { specialValue: "0 : 16.5", outcome: "2 AH" } },
							"-17.5": { home: { specialValue: "0 : 17.5", outcome: "1 AH" }, away: { specialValue: "0 : 17.5", outcome: "2 AH" } },
							"-18.5": { home: { specialValue: "0 : 18.5", outcome: "1 AH" }, away: { specialValue: "0 : 18.5", outcome: "2 AH" } },
							"-19.5": { home: { specialValue: "0 : 19.5", outcome: "1 AH" }, away: { specialValue: "0 : 19.5", outcome: "2 AH" } },
							"-20.5": { home: { specialValue: "0 : 20.5", outcome: "1 AH" }, away: { specialValue: "0 : 20.5", outcome: "2 AH" } },
							"-21.5": { home: { specialValue: "0 : 21.5", outcome: "1 AH" }, away: { specialValue: "0 : 21.5", outcome: "2 AH" } },
							"-22.5": { home: { specialValue: "0 : 22.5", outcome: "1 AH" }, away: { specialValue: "0 : 22.5", outcome: "2 AH" } },
							"-23.5": { home: { specialValue: "0 : 23.5", outcome: "1 AH" }, away: { specialValue: "0 : 23.5", outcome: "2 AH" } },
							"-24.5": { home: { specialValue: "0 : 24.5", outcome: "1 AH" }, away: { specialValue: "0 : 24.5", outcome: "2 AH" } },
							"-25.5": { home: { specialValue: "0 : 25.5", outcome: "1 AH" }, away: { specialValue: "0 : 25.5", outcome: "2 AH" } },
							"-26.5": { home: { specialValue: "0 : 26.5", outcome: "1 AH" }, away: { specialValue: "0 : 26.5", outcome: "2 AH" } },
							"-27.5": { home: { specialValue: "0 : 27.5", outcome: "1 AH" }, away: { specialValue: "0 : 27.5", outcome: "2 AH" } },
							"-28.5": { home: { specialValue: "0 : 28.5", outcome: "1 AH" }, away: { specialValue: "0 : 28.5", outcome: "2 AH" } },
							"-29.5": { home: { specialValue: "0 : 29.5", outcome: "1 AH" }, away: { specialValue: "0 : 29.5", outcome: "2 AH" } },
							"-30.5": { home: { specialValue: "0 : 30.5", outcome: "1 AH" }, away: { specialValue: "0 : 30.5", outcome: "2 AH" } },
							"-31.5": { home: { specialValue: "0 : 31.5", outcome: "1 AH" }, away: { specialValue: "0 : 31.5", outcome: "2 AH" } },
							"-32.5": { home: { specialValue: "0 : 32.5", outcome: "1 AH" }, away: { specialValue: "0 : 32.5", outcome: "2 AH" } },
							"-33.5": { home: { specialValue: "0 : 33.5", outcome: "1 AH" }, away: { specialValue: "0 : 33.5", outcome: "2 AH" } },
							"-34.5": { home: { specialValue: "0 : 34.5", outcome: "1 AH" }, away: { specialValue: "0 : 34.5", outcome: "2 AH" } },
							"-35.5": { home: { specialValue: "0 : 35.5", outcome: "1 AH" }, away: { specialValue: "0 : 35.5", outcome: "2 AH" } },
							"-36.5": { home: { specialValue: "0 : 36.5", outcome: "1 AH" }, away: { specialValue: "0 : 36.5", outcome: "2 AH" } },
							"-37.5": { home: { specialValue: "0 : 37.5", outcome: "1 AH" }, away: { specialValue: "0 : 37.5", outcome: "2 AH" } },
							"-38.5": { home: { specialValue: "0 : 38.5", outcome: "1 AH" }, away: { specialValue: "0 : 38.5", outcome: "2 AH" } },
							"-39.5": { home: { specialValue: "0 : 39.5", outcome: "1 AH" }, away: { specialValue: "0 : 39.5", outcome: "2 AH" } },
							"-40.5": { home: { specialValue: "0 : 40.5", outcome: "1 AH" }, away: { specialValue: "0 : 40.5", outcome: "2 AH" } },
							"-41.5": { home: { specialValue: "0 : 41.5", outcome: "1 AH" }, away: { specialValue: "0 : 41.5", outcome: "2 AH" } },
							"-42.5": { home: { specialValue: "0 : 42.5", outcome: "1 AH" }, away: { specialValue: "0 : 42.5", outcome: "2 AH" } },
							"-43.5": { home: { specialValue: "0 : 43.5", outcome: "1 AH" }, away: { specialValue: "0 : 43.5", outcome: "2 AH" } },
							"-44.5": { home: { specialValue: "0 : 44.5", outcome: "1 AH" }, away: { specialValue: "0 : 44.5", outcome: "2 AH" } },
							"-45.5": { home: { specialValue: "0 : 45.5", outcome: "1 AH" }, away: { specialValue: "0 : 45.5", outcome: "2 AH" } },
							"-46.5": { home: { specialValue: "0 : 46.5", outcome: "1 AH" }, away: { specialValue: "0 : 46.5", outcome: "2 AH" } },
							"-47.5": { home: { specialValue: "0 : 47.5", outcome: "1 AH" }, away: { specialValue: "0 : 47.5", outcome: "2 AH" } },
							"-48.5": { home: { specialValue: "0 : 48.5", outcome: "1 AH" }, away: { specialValue: "0 : 48.5", outcome: "2 AH" } },
							"-49.5": { home: { specialValue: "0 : 49.5", outcome: "1 AH" }, away: { specialValue: "0 : 49.5", outcome: "2 AH" } },
							"-50.0": { home: { specialValue: "0 : 50.0", outcome: "1 AH" }, away: { specialValue: "0 : 50.0", outcome: "2 AH" } },

							// --- Special Case: 0.0 Handicap (Money Line) ---
							// "0.0": { name: "Draw No Bet", outcome: { home: "1 DNB", away: "2 DNB" } },
							"0.0": {
								home: { marketName: "Draw No Bet", outcome: "1 DNB" },
								away: { marketName: "Draw No Bet", outcome: "2 DNB" }
							}
						}
					}
				}
			},
			"team_total": {
				name: "team total",
				sport: {
					'1': { '*': { label: 'Team Total Goals', outcome: { home: "Home", away: "Away" } } },
					'3': { '*': { label: 'Team Total (Incl. Overtime)', outcome: { home: "Home", away: "Away" } } }
				}
			}
		};

	}

	#loadCookies = async (username) => {
		const cookiePath = path.resolve(`data/cookies/${username}-cookies.json`);
		try {
			const cookieData = await fs.readFile(cookiePath, 'utf8');
			return JSON.parse(cookieData);
		} catch (error) {
			return [];
		}
	};

	#saveCookies = async (username, cookies) => {
		const cookiePath = path.resolve(`./data/cookies/${username}-cookies.json`);
		await fs.mkdir(path.dirname(cookiePath), { recursive: true });
		await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));
	};

	#areCookiesValid = async (cookies) => {
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
	};

	#fetchJsonFromApi = async (url) => {
		const browser = this.browser;
		let page;
		try {
			page = await browser.newPage();
			await page.setExtraHTTPHeaders({
				'Cache-Control': 'no-cache',
				'Pragma': 'no-cache'
			});
			const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
			if (!response.ok()) {
				throw new Error(`Request failed with status: ${response.status()}`);
			}
			let res = await response.json();
			return res;
		} catch (error) {
			console.error(`[Bookmaker] Error fetching API URL ${url}:`, error.message);
			return null;
		} finally {
			await page.evaluate(() => {
				window.localStorage.clear();
				window.sessionStorage.clear();
			});
			await page.close();
		}
	};

	#slugifyEventName = (name) => {
		if (!name) return '';
		return name.toLowerCase()
			.replace(/ & /g, ' and ')
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/-+/g, '-');
	};

	#normalizeTeamName = (name) => {
		if (!name) return '';
		let cleanedName = name.replace(/\s*\([^)]*\)/g, '');
		cleanedName = cleanedName.replace(/\s*(u\d{2})\b/gi, '');
		const parts = cleanedName.toLowerCase().split(/[ \/-]/).filter(part => part);
		let start = 0;
		let end = parts.length;
		while (start < end && parts[start].length < 3) {
			start++;
		}
		while (end > start && parts[end - 1].length < 3) {
			end--;
		}
		let meaningfulParts = parts.slice(start, end);
		if (!meaningfulParts.length) {
			meaningfulParts = [parts.reduce((longest, part) => part.length > longest.length ? part : longest, '')];
			console.log(`[Bookmaker] No meaningful parts, using longest: "${meaningfulParts[0]}"`);
		}
		let normalized = meaningfulParts.join(' ');
		normalized = normalized.replace(/[.-]/g, ' ');
		normalized = normalized.replace(/\s+/g, ' ');
		normalized = normalized.trim();
		// console.log(`[Bookmaker] Final normalized name: "${normalized}"`);
		return normalized;
	};

	getStatus() {
		return this.state;
	}

	async getTeamDataById(matchId) {
		if (!matchId || typeof matchId !== 'string') return null;
		const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Match/${matchId}`;
		return this.#fetchJsonFromApi(url);
	}

	async getTeamDataByName(searchTerm) {
		if (!searchTerm || typeof searchTerm !== 'string') return null;
		const formattedSearchTerm = encodeURIComponent(searchTerm.trim());
		const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Search/lang/en?search=${formattedSearchTerm}`;
		const data = await this.#fetchJsonFromApi(url);
		if (!data) return null;
		const matches = Array.isArray(data) ? data : data.matches || data.results || [];
		const filteredMatches = matches.filter(match => match.TeamHome && match.TeamAway);
		return filteredMatches;
	}

	async getMatchDataByTeamPair(home, away) {
		if (!home || !away) return null;

		const normalizedHome = this.#normalizeTeamName(home);
		const normalizedAway = this.#normalizeTeamName(away);
		const combinedSearchTerm = `${normalizedHome} - ${normalizedAway}`;

		try {
			// console.log(`[Bookmaker] Starting Searching for both "${home}" and "${away}"`);
			const homeResults = await this.getTeamDataByName(home);
			const awayResults = await this.getTeamDataByName(away);

			const allMatches = [...(homeResults || []), ...(awayResults || [])];
			const uniqueMatches = Array.from(new Map(allMatches.map(match => [match.IDEvent, match])).values());

			if (!uniqueMatches.length) {
				// console.log(`[Bookmaker] No matches found for either "${home}" or "${away}"`);
				return null;
			}

			console.log(`[Bookmaker] Search: "${normalizedHome}" vs "${normalizedAway}"`);
			const searchableMatches = uniqueMatches.map(match => {
				const apiHome = this.#normalizeTeamName(match.TeamHome);
				const apiAway = this.#normalizeTeamName(match.TeamAway);
				return {
					...match,
					combinedEventName: `${apiHome} - ${apiAway}`
				};
			});

			const fuse = new Fuse(searchableMatches, {
				includeScore: true,
				threshold: 0.6,
				keys: ['combinedEventName']
			});

			const results = fuse.search({
				$or: [
					{ combinedEventName: `${normalizedHome} - ${normalizedAway}` },
					{ combinedEventName: `${normalizedAway} - ${normalizedHome}` }
				]
			});
			console.log(`[Bookmaker] Search results for Teams ${combinedSearchTerm}`, results.map(r => {
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

			if (bestResult.score <= 0.6) {
				console.log(chalk.green(`[Bookmaker] Found confident match - score (${bestResultPercentage.toFixed(2)}%): "${bestResult.item.EventName}" - below threshold.`));
				return bestResult.item;
			}

			console.log(chalk.red(`[Bookmaker] No suitable match found - score (${bestResultPercentage.toFixed(2)}%) - above threshold.`));
			return null;
		} catch (error) {
			console.error(`[Bookmaker] Error in getBetKingMatchDataByTeamPair:`, error.message);
			return null;
		}
	}

	async verifyMatch(timeA, timeB) {
		if (!timeA || !timeB) {
			console.error('[Bot] Missing date information for verification.');
			return false;
		}

		try {
			const bookmakerDate = new Date(timeA);
			const providerDate = new Date(parseInt(timeB, 10));
			const fiveMinutesInMs = 5 * 60 * 1000;
			const timeDifference = Math.abs(providerDate.getTime() - bookmakerDate.getTime());

			if (timeDifference <= fiveMinutesInMs) {
				// console.log(`[Bookmaker] Time verification successful.`);
				return true;
			} else {
				// console.log(`[Bookmaker] Time verification failed. Difference: ${timeDifference / 60000} minutes.`);
				return false;
			}
		} catch (error) {
			console.error('[Bot] Error comparing match times:', error);
			return false;
		}
	}

	async getMatchDetailsByEvent(eventId, eventName) {
		if (!eventId || !eventName) return null;

		const eventSlug = this.#slugifyEventName(eventName);
		const url = `https://m.betking.com/sports/prematch/${eventId}/${eventSlug}`;
		// console.log(`[Bookmaker] Fetching data from page: .../${eventId}/${eventSlug}`);

		const browser = this.browser;
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

			await browser.setCookie({
				name: 'ABTestNewVirtualsLobby',
				value: 'false',
				domain: 'm.betking.com'
			});

			await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });

			const remixContentDetails = await page.evaluate(() => {
				if (window.__remixContext) {
					return window.__remixContext;
				} else {
					throw new Error('Could not find __remixContext on the window object.');
				}
			});

			const loaderData = remixContentDetails?.state?.loaderData;
			const matchEventDetails = loaderData["routes/($locale).sports.prematch.$matchId.$eventName.($areaId)._index"]?.event;
			const matchEventId = matchEventDetails?.id;

			if (!matchEventDetails || !matchEventId) {
				console.warn(chalk.yellow('[Bookmaker] Could not find complete event data in Remix context for this match. Skipping.'));
				return null;
			}

			if (matchEventId != eventId) {
				throw new Error("Event Id mismatch, Event-Id does not match fetched Match-Details-Event-Id");
			}

			return matchEventDetails;
		} catch (error) {
			console.error(`[Bookmaker] Error extracting Remix JSON on page .../${eventId}/${eventSlug}`, error.message);
			return null;
		} finally {
			await page.close();
		}
	}

	async signin(username, password) {
		const signinData = {
			__rvfInternalFormId: "signIn",
			anonymousId: "",
			username: username,
			password: password,
			url: "https://m.betking.com/my-accounts/login?urlAfterLogin=/",
			// signedInUrl: "https://m.betking.com/my-accounts/login",
			signedInUrl: "https://m.betking.com/",
			location: "/",
			action: ""
		};

		const browser = this.browser;
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

			await page.goto(signinData.url, { waitUntil: 'load', timeout: 30000 });

			await page.waitForSelector('#username', { timeout: 10000 }).catch(() => {
				throw new Error('Username field not found. Verify selector.');
			});
			await page.type('#username', signinData.username);

			await page.waitForSelector('#password', { timeout: 10000 }).catch(() => {
				throw new Error('Password field not found. Verify selector.');
			});
			await page.type('#password', signinData.password);

			await page.keyboard.press('Enter');

			await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 });
			if (page.url().startsWith(signinData.signedInUrl)) {
				console.log(`[Bookmaker] Logged in ${username}`);
			} else {
				throw new Error(`Login failed. Expected to be at ${signinData.signedInUrl} but ended up at ${page.url()}`);
			}

			const cookies = await page.cookies();
			await this.#saveCookies(username, cookies);
			this.state = { status: 'AUTHENTICATED', message: 'Sign-in successful.' };

			return {
				success: true,
				cookies: cookies,
			};
		} catch (error) {
			this.state = { status: 'LOGIN FAILED', message: error.message };
			console.error(`[Bookmaker] Error logging in to ${signinData.url}:`, error.message);
			return { success: false, error: error.message };
		} finally {
			await page.close();
		}
	}

	async getAccountInfo(username) {
		const cookies = await this.#loadCookies(username);
		if (!cookies || cookies.length === 0) {
			throw new AuthenticationError('No saved cookies found.');
		}
		if (!await this.#areCookiesValid(cookies)) {
			throw new AuthenticationError('Cookies have expired.');
		}

		const browser = this.browser;
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

			await page.setCookie(...cookies);
			await page.setJavaScriptEnabled(false);

			await page.goto('https://m.betking.com', { waitUntil: 'domcontentloaded', timeout: 30000 });

			const propsString = await page.$eval(
				'astro-island[component-export="Header"]',
				(island) => island.getAttribute('props')
			);
			if (!propsString) throw new Error("Could not find the Header props attribute.");

			const props = JSON.parse(propsString, (key, value) => {
				if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'number') {
					return value[1];
				}
				return value;
			});

			const contextContent = await page.evaluate(() => {
				const scripts = Array.from(document.querySelectorAll('script'));
				const contextScript = scripts.find(s => s.textContent.includes('__remixContext'));
				return contextScript ? contextScript.textContent : null;
			});

			if (!contextContent) throw new Error("Could not find the Remix context script.");

			const jsonString = contextContent.substring(contextContent.indexOf('{'), contextContent.lastIndexOf('}') + 1);
			const remixContext = JSON.parse(jsonString);

			const openBetsCount = remixContext?.state?.loaderData?.root?.betsCount;

			if (props.balance !== undefined && openBetsCount !== undefined) {
				const accountInfo = {
					balance: parseFloat(props.balance),
					openBetsCount: parseInt(openBetsCount, 10),
					accessToken: props.accessToken,
					freeBets: props.freeBets,
					unreadMessageCount: props.unreadMessageCount,
					isAuth: props.auth
				};
				console.log(`[Bookmaker] Successfully extracted account info for ${username}`);
				this.state = { status: 'AUTHENTICATED', message: 'Session is active.' };
				return accountInfo;
			} else {
				throw new Error('Account info (balance or openBetsCount) not found in page data.');
			}
		} catch (error) {
			if (error instanceof AuthenticationError) {
				this.state = { status: 'UNAUTHENTICATED', message: error.message };
			} else {
				this.state = { status: 'ERROR', message: error.message };
			}
			console.error(`[Bookmaker] Error getting account info:`, error.message);
			throw error;
		} finally {
			if (page) await page.close();
		}
	}

	async placeBet(username, data) {
		const browser = this.browser;
		let page;

		try {
			console.log('[Bookmaker] Starting place bet process for', username);

			const cookies = await this.#loadCookies(username);
			if (!cookies.length) {
				throw new AuthenticationError('No cookies found.');
			}
			if (!await this.#areCookiesValid(cookies)) {
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

			// console.log('[Bookmaker] Navigating to betslip page to acquire session data...');
			await page.goto('https://m.betking.com/sports/betslip', { waitUntil: 'domcontentloaded', timeout: 60000 });

			// console.log('[Bookmaker] Waiting for page to be ready...');
			await page.waitForSelector('[id*="islandsToolbar"]', { timeout: 15000 });

			const result = await page.evaluate(async (dataToPost) => {
				const headerIsland = document.querySelector('astro-island[component-export="Header"]');
				if (!headerIsland) {
					return { error: true, status: 500, text: "Could not find the header's astro-island element." };
				}

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

				const headers = {
					'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
					'Referer': 'https://m.betking.com/sports/betslip',
					'Authorization': `Bearer ${accessToken}`,
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

	constructBetPayload(matchData, market, selection, stakeAmount, providerData) {
		const totalOdds = selection.odd.value;
		const potentialWinnings = stakeAmount * totalOdds;
		const eventCategory = this.sportIdMapper[providerData.sportId] || 'F';

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
	}

	translateProviderData({ lineType, outcome, sportId, points, periodNumber, odds }) {
		const mapping = this.lineTypeMapper[lineType];
		if (!mapping) {
			console.log(`[Bot - BOOKMAKER] Unsupported line type: ${lineType}`);
			return null;
		}

		const providerOutcomeKey = outcome.toLowerCase();
		const selectionName = mapping.outcome[providerOutcomeKey];
		if (!selectionName) {
			console.error(`[Bot] Unknown outcome: ${outcome} for line type ${lineType}`);
			return null;
		}

		if (!odds || isNaN(parseFloat(odds))) {
			console.error(`[Bot] Invalid odds for outcome: ${providerOutcomeKey}`);
			return null;
		}

		if (sportId === '1') {
			const sportMarkets = mapping.marketsBySport?.['1'] || {
				'0': lineType === 'total' ? 'Total Goals' : 'Handicap'
			};
			const marketName = lineType === 'total' ? sportMarkets['0'] : mapping.name;
			let betkingMarketName = lineType === 'total' ? `${marketName} ${points}` : marketName;
			let betkingSelectionName = selectionName;
			let betkingSpecialValue = lineType === 'total' ? points : null;

			if (lineType === 'spread') {
				const parsedPoints = parseFloat(points);
				if (!isNaN(parsedPoints)) {
					if (parsedPoints === 0) {
						betkingMarketName = 'Draw No Bet';
						betkingSelectionName = providerOutcomeKey === 'home' ? '1 DNB' : '2 DNB';
						betkingSpecialValue = '0';
					} else if (parsedPoints === 0.5) {
						betkingMarketName = 'Double Chance';
						betkingSelectionName = providerOutcomeKey === 'home' ? '1X' : 'X2';
						betkingSpecialValue = '0';
					} else {
						if (Number.isInteger(parsedPoints)) {
							if (providerOutcomeKey === 'home') {
								betkingSpecialValue = parsedPoints < 0 ? `0:${-parsedPoints}` : `${parsedPoints}:0`;
								betkingSelectionName = 'Home';
							} else {
								betkingSpecialValue = parsedPoints < 0 ? `${-parsedPoints}:0` : `0:${parsedPoints}`;
								betkingSelectionName = 'Away';
							}
							betkingMarketName = `Handicap ${parsedPoints}`;
						} else {
							console.log(`[Bot] Quarter-goal handicap (${parsedPoints}) not supported yet.`);
							return null;
						}
					}
				}
			}

			console.log(`[Bot] Translated Football: Sport=${sportId}, LineType=${lineType}, Outcome=${providerOutcomeKey}, Points=${points || 'N/A'}, Market=${betkingMarketName}, Selection=${betkingSelectionName}, Odds=${odds}`);
			return {
				marketName: betkingMarketName,
				selectionName: betkingSelectionName,
				points,
				specialValue: betkingSpecialValue,
				odds
			};
		} else if (sportId === '3') {
			if (!['total', 'spread'].includes(lineType)) {
				console.log(`[Bot] Unsupported basketball line type: ${lineType}. Only total and spread bets supported.`);
				return null;
			}

			const sportMarkets = mapping.marketsBySport?.['3'] || {
				'0': lineType === 'total' ? 'Total (Incl. Overtime)' : 'Handicap (Incl. Overtime)'
			};
			const effectivePeriod = periodNumber || '0';
			if (effectivePeriod !== '0') {
				console.log(`[Bot] Unsupported basketball period: ${effectivePeriod}. Only full-game (period 0) supported.`);
				return null;
			}
			let betkingMarketName = lineType === 'total' ? `${sportMarkets[effectivePeriod]} ${points}` : sportMarkets[effectivePeriod];
			let betkingSelectionName = selectionName;
			let betkingSpecialValue = lineType === 'total' ? points : null;

			if (lineType === 'spread') {
				const parsedPoints = parseFloat(points);
				if (!isNaN(parsedPoints)) {
					if (parsedPoints === 0) {
						betkingMarketName = 'DNB RT';
						betkingSelectionName = providerOutcomeKey === 'home' ? '1 DNB' : '2 DNB';
						betkingSpecialValue = '0';
					} else {
						betkingMarketName = `Handicap (Incl. Overtime) ${parsedPoints}`;
						if (providerOutcomeKey === 'home') {
							betkingSpecialValue = parsedPoints < 0 ? `0 : ${Math.abs(parsedPoints)}` : `${Math.abs(parsedPoints)} : 0`;
							betkingSelectionName = '1 AH';
						} else {
							betkingSpecialValue = parsedPoints < 0 ? `${Math.abs(parsedPoints)} : 0` : `0 : ${Math.abs(parsedPoints)}`;
							betkingSelectionName = '2 AH';
						}
					}
				}
			}

			console.log(`[Bot] Translated Basketball: Sport=${sportId}, LineType=${lineType}, Period=${effectivePeriod}, Outcome=${providerOutcomeKey}, Points=${points || 'N/A'}, Market=${betkingMarketName}, Selection=${betkingSelectionName}, Odds=${odds}`);
			return {
				marketName: betkingMarketName,
				selectionName: betkingSelectionName,
				points,
				periodNumber: effectivePeriod,
				specialValue: betkingSpecialValue,
				odds
			};
		}

		console.log(`[Bot] Unsupported sportId: ${sportId}. Using generic mapping.`);
		return {
			marketName: mapping.name,
			selectionName,
			points,
			odds
		};
	}
}

export default BetKingBookmaker;
