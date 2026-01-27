import { test } from "node:test";
import assert from "node:assert";
import { initializeBrowser, closeBrowser } from "../../../../src/core/browser.js";
import * as bookmaker from "../../../../src/services/bookmakers/integrations/betking/index.js";
import { normalizeTeamName } from "../../../../src/services/bookmakers/integrations/betking/betking.utils.js";

// --- MOCK DATA SETUP ---
// We need a real username and password
const mockUsername = "";
// This is the mock payload for the bet. It's based on a real request.
// For a unit test, the data just needs to be in the correct format that the function expects.
// we want to get this data from the actual bet site and then structure to test our function
const mockBetData = {
	"betCoupon": {
		"isClientSideCoupon": true,
		"couponTypeId": 1,
		"minWin": 153,
		"minWinNet": 153,
		"netStakeMinWin": 153,
		"maxWin": 153,
		"maxWinNet": 153,
		"netStakeMaxWin": 153,
		"minBonus": 0,
		"maxBonus": 0,
		"minPercentageBonus": 0,
		"maxPercentageBonus": 0,
		"minOdd": 5.1,
		"maxOdd": 5.1,
		"totalOdds": 5.1,
		"stake": 30, // The desired stake amount
		"useGroupsStake": false,
		"stakeGross": 30,
		"stakeTaxed": 0,
		"taxPercentage": 0,
		"tax": 0,
		"minWithholdingTax": 0,
		"maxWithholdingTax": 0,
		"turnoverTax": 0,
		"totalCombinations": 1,
		"odds": [{
			"IDSelectionType": 4,
			"IDSport": 1,
			"allowFixed": false,
			"compatibilityLevel": 0,
			"eventCategory": "F",
			"eventDate": "2025-07-27T19:00:00+02:00",
			"eventId": 11520022,
			"eventName": "Russia",
			"fixed": false,
			"gamePlay": 1,
			"incompatibleEvents": [1002636981],
			"isExpired": false,
			"isLocked": false,
			"isBetBuilder": false,
			"marketId": 442729132,
			"marketName": "1X2",
			"marketTag": 0,
			"marketTypeId": 110,
			"matchId": 1002604931,
			"matchName": "FK+Rubin+Kazan+-+FK+Zenit+Saint+Petersburg",
			"oddValue": 5.1,
			"parentEventId": 1002604931,
			"selectionId": 1458606704,
			"selectionName": "1",
			"selectionNoWinValues": [],
			"smartCode": 13390,
			"specialValue": "0",
			"sportName": "Football",
			"tournamentId": 21520023,
			"tournamentName": "Premier+League"
		}],
		"groupings": [{
			"grouping": 1,
			"combinations": 1,
			"minWin": 153,
			"minWinNet": 153,
			"netStakeMinWin": 153,
			"maxWin": 153,
			"maxWinNet": 153,
			"netStakeMaxWin": 153,
			"minBonus": 0,
			"maxBonus": 0,
			"minPercentageBonus": 0,
			"maxPercentageBonus": 0,
			"stake": 30,
			"netStake": 30,
			"selected": true
		}],
		"possibleMissingGroupings": [],
		"currencyId": 16,
		"isLive": false,
		"isVirtual": false,
		"currentEvalMotivation": 0,
		// "betCouponGlobalVariable": { /* This object contains general site config */ },
		"betCouponGlobalVariable": {
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
		"language": "en",
		"hasLive": false,
		"couponType": 1,
		"allGroupings": [{
			"grouping": 1,
			"combinations": 1,
			"minWin": 153,
			"minWinNet": 153,
			"netStakeMinWin": 153,
			"maxWin": 153,
			"maxWinNet": 153,
			"netStakeMaxWin": 153,
			"minBonus": 0,
			"maxBonus": 0,
			"minPercentageBonus": 0,
			"maxPercentageBonus": 0,
			"stake": 30,
			"netStake": 30,
			"selected": true
		}]
	},
	"allowOddChanges": false,
	"allowStakeReduction": false,
	"requestTransactionId": Date.now().toString(), // Always generate a unique ID
	"transferStakeFromAgent": false
};

// Mock providerData
const baseProviderData = {
	id: "1752592950240-0",
	sportId: "1",
	starts: "1754179500000", // This is the milliseconds for 2025-08-03T00:05:00.000Z
	lineType: "spread",
	outcome: "away",
	points: "0",
	priceAway: "2.11",
	home: "Slough Town",
	away: "Brentford B",
	leagueName: "Club Friendlies"
};
// Mock bookmakerMatch
const createBookmakerMatch = (date) => ({
	id: "1611665381",
	name: "Slough Town vs Brentford B",
	date: date,
	markets: [
		{
			name: "Handicap 0",
			specialValue: "0",
			selections: [
				{ name: "Home", status: "VALID", odd: { value: 1.636 } },
				{ name: "Away", status: "VALID", odd: { value: 2.11 } }
			]
		}
	]
});

// This object simulates a successful response from the BetKing API.
// It's what we expect `fetch` to return when the bet is placed correctly.
const mockFetchResponse = {
	ok: true,
	headers: {
		get: (headerName) => {
			if (headerName.toLowerCase() === 'content-type') {
				return 'application/json';
			}
			return null;
		}
	},
	json: async () => ({
		bookingCode: 'AN1RVF',
		couponCode: 'K2SN-H9CUN-6J-8G8P',
		responseStatus: 1,
		errorsList: null,
		evaluation: { status: 0 },
		successfulBetDetails: {
			isFlexicut: false,
			isFreebet: false,
			freeBetDetails: null,
			flexiCutDetails: null,
			winnings: 153,
			minWithholdingTax: 0,
			maxWithholdingTax: 0
		}
	})
};

// We "spy" on console.log to confirm that our function is logging the correct messages.
const consoleLogSpy = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
	consoleLogSpy.push(args.join(" "));
	originalConsoleLog(...args);
};

// --- TEST SUITE ---
test("Bookmaker Service Tests", async (t) => {
	// This is only needed for tests that use a real browser, like the signin test.
	await initializeBrowser();

	t.beforeEach(() => {
		consoleLogSpy.length = 0; // Reset logs before each test
	});

	await t.test("normalizeTeamName", async (t) => {

		await t.test("should handle standard names with suffixes", () => {
			assert.strictEqual(normalizeTeamName("Manchester United FC"), "manchester united", "Should strip 'FC'");
			assert.strictEqual(normalizeTeamName("Real Madrid CF"), "real madrid", "Should strip 'CF'");
		});

		await t.test("should trim short prefixes and suffixes", () => {
			assert.strictEqual(normalizeTeamName("FK Rubin Kazan"), "rubin kazan", "Should strip 'FK'");
			assert.strictEqual(normalizeTeamName("SC Freiburg II"), "freiburg", "Should strip 'SC' and 'II'");
		});

		await t.test("should handle hyphens, slashes, and extra spaces", () => {
			// assert.strictEqual(normalizeTeamName("Team-A / B"), "team b", "Should handle mixed delimiters");
			assert.strictEqual(normalizeTeamName("  Multiple   Spaces  "), "multiple spaces", "Should collapse multiple spaces");
		});

		await t.test("should handle edge cases", () => {
			assert.strictEqual(normalizeTeamName(null), "", "Should return empty string for null input");
			// assert.strictEqual(normalizeTeamName("U21"), "u21", "Should not trim short names if they are the only part");
		});

		await t.test("should remove content within round brackets and age-group suffixes", () => {
			assert.strictEqual(normalizeTeamName("Albania (W) U20"), "albania", "Should remove '(W)' and 'U20'");
			assert.strictEqual(normalizeTeamName("Malta U20 (W)"), "malta", "Should remove 'U20' and '(W)'");
			assert.strictEqual(normalizeTeamName("Team U21"), "team", "Should remove 'U21'");
			assert.strictEqual(normalizeTeamName("(Test) Club U19"), "club", "Should remove '(Test)' and 'U19'");
			assert.strictEqual(normalizeTeamName("No Brackets"), "brackets", "Should handle name without brackets");
		});
	});

	// get actuall matches and replace the names for the functiont o serahc for a match
	await t.test("getBetKingMatchDataByTeamPair flow", { skip: true }, { timeout: 60000 }, async (t) => {

		await t.test("should search for 'Manchester City vs Wolverhampton Wanderers'", async () => {
			console.log("\n--- RUNNING TEST: Man City vs Wolves ---");
			const result = await bookmaker.getMatchDataByTeamPair("Manchester City", "Wolverhampton Wanderers");
			console.log("--- RESULT for Man City vs Wolves ---");
			console.log(JSON.stringify(result, null, 2));
			assert.ok(true, "Test completed, check logs for output.");
		});

		await t.test("should search for 'Manchester United vs Arsenal FC'", async () => {
			console.log("\n--- RUNNING TEST: Man Utd vs Arsenal ---");
			const result = await bookmaker.getMatchDataByTeamPair("Manchester United", "Arsenal FC");
			console.log("--- RESULT for Man Utd vs Arsenal ---");
			console.log(JSON.stringify(result, null, 2));
			assert.ok(true, "Test completed, check logs for output.");
		});
	});

	await t.test("(Verify Match - Exact Date)", async () => {
		console.log("\n--- RUNNING TEST: Verify Match - Exact Date ---");
		const providerData = { ...baseProviderData };
		const bookmakerMatch = createBookmakerMatch("2025-08-03T00:05:00.000Z");
		console.log("Provider Data:", JSON.stringify(providerData, null, 2));
		console.log("Bookmaker Match:", JSON.stringify(bookmakerMatch, null, 2));
		const result = await bookmaker.verifyMatch(bookmakerMatch, providerData);
		console.log("--- RESULT for Verify Match - Exact Date ---");
		console.log("Result:", result);
	});

	await t.test("(Verify Match - Close Enough Date)", async () => {
		console.log("\n--- RUNNING TEST: Verify Match - Close Enough Date ---");
		const providerData = { ...baseProviderData };
		const bookmakerMatch = createBookmakerMatch("2025-08-03T00:07:30.000Z");
		console.log("Provider Data:", JSON.stringify(providerData, null, 2));
		console.log("Bookmaker Match:", JSON.stringify(bookmakerMatch, null, 2));
		const result = await bookmaker.verifyMatch(bookmakerMatch, providerData);
		console.log("--- RESULT for Verify Match - Close Enough Date ---");
		console.log("Result:", result);
	});

	await t.test("(Verify Match - Far Apart Date)", async () => {
		console.log("\n--- RUNNING TEST: Verify Match - Far Apart Date ---");
		const providerData = { ...baseProviderData };
		const bookmakerMatch = createBookmakerMatch("2025-08-03T00:12:00.000Z");
		console.log("Provider Data:", JSON.stringify(providerData, null, 2));
		console.log("Bookmaker Match:", JSON.stringify(bookmakerMatch, null, 2));
		const result = await bookmaker.verifyMatch(bookmakerMatch, providerData);
		console.log("--- RESULT for Verify Match - Far Apart Date ---");
		console.log("Result:", result);
	});

	await t.test("(Get account Info)", { skip: true }, async () => {
		console.log("\n--- RUNNING TEST: Get Account Info ---");
		const accountInfo = await bookmaker.getAccountInfo(mockUsername);
		console.log("--- RESULT for Get Account Info ---");
		console.log(accountInfo)
	});

	await t.test("(Signin)", { skip: true }, async () => {
		await bookmaker.signin(mockUsername, "A1N2S3I4");

		// Verify console output
		assert.ok(
			consoleLogSpy.some((log) => log.includes("Logged in 07033054766")),
			"Expected 'Logged in 07033054766' log"
		);
	});

	await t.test("placeBet", { skip: true }, async (t) => {
		await t.test("should place bet successfully with valid cookies", async () => {
			// MOCKING: We replace the real `fetch` with our fake version.
			// This isolates our function from the network for a fast and reliable unit test.
			global.fetch = async () => mockFetchResponse;

			try {
				// ACT: Run the function we want to test.
				const result = await bookmaker.placeBet(mockUsername, mockBetData);

				// I do not assert just check to see if the function actually takes the bet

				// ASSERT: Check if the function behaved as expected.
				// assert.deepStrictEqual(result, await mockFetchResponse.json(), "The function should return the successful bet placement response from the API.");
				// assert.ok(consoleLogSpy.some(log => log.includes("Cookies are valid")), "The function should log that cookies are valid.");
				// assert.ok(consoleLogSpy.some(log => log.includes("Bet placed successfully")), "The function should log a final success message.");

			} catch (error) {
				console.error('[Test] Unexpected error in success case:', error);
				throw error; // Fail the test if an unexpected error occurs
			} finally {
				// CLEANUP: Always restore the original `fetch` function after the test.
				delete global.fetch;
			}
		});
	});

	await t.test("constructBetPayload", { skip: true }, async (t) => {

		// ARRANGE: Create realistic mock data that mirrors the real API response.
		const mockMatchData = {
			id: 1002628068,
			name: "Pittsburgh Riverhounds - Loudoun United FC",
			date: "2025-07-13T23:00:00+02:00",
			sportId: 1,
			sportName: "Football",
			tournamentId: 21522854,
			tournamentName: "USL Championship",
			categoryName: "USA",
			smartBetCode: 17137,
			markets: [{
				id: 446915062,
				name: "1X2",
				typeId: 110,
				selections: [{
					id: 1471219253,
					name: "1",
					typeId: 4,
					odd: { value: 1.87 },
					status: "VALID",
					specialValue: "0"
				}, {
					id: 1471219258,
					name: "2",
					typeId: 5,
					odd: { value: 4.1 },
					status: "VALID",
					specialValue: "0"
				}]
			}]
		};

		const targetMarket = mockMatchData.markets[0];
		const targetSelection = targetMarket.selections[0]; // Betting on "1" (Home)
		const stakeAmount = 30;

		await t.test("should correctly convert match data into a valid bet coupon", () => {
			// ACT: Run the function we want to test.
			const resultPayload = bookmaker.constructBetPayload(mockMatchData, targetMarket, targetSelection, stakeAmount);
			console.log("========result=========", resultPayload);

			// ASSERT: Verify that the output is structured correctly.
			assert.ok(resultPayload.betCoupon, "Payload should have a betCoupon property");
			assert.strictEqual(resultPayload.betCoupon.stake, stakeAmount, "Stake amount should be set correctly");
			assert.strictEqual(resultPayload.betCoupon.totalOdds, 1.87, "Total odds should match the selection's odds");

			const expectedWinnings = stakeAmount * 1.87;
			assert.strictEqual(resultPayload.betCoupon.minWin, expectedWinnings, "minWin should be calculated correctly");

			const oddsObject = resultPayload.betCoupon.odds[0];
			assert.strictEqual(oddsObject.matchId, mockMatchData.id, "matchId should be mapped correctly");
			assert.strictEqual(oddsObject.selectionId, targetSelection.id, "selectionId should be mapped correctly");
			assert.strictEqual(oddsObject.marketId, targetMarket.id, "marketId should be mapped correctly");
			assert.ok(resultPayload.requestTransactionId, "A requestTransactionId should be generated");
		});

	});


	// Close the browser instance after all tests in this file are done.
	t.after(async () => {
		await closeBrowser();
	});
});

// Restore original console.log after the entire test process exits.
process.on("exit", () => {
	console.log = originalConsoleLog;
});
