import { test, mock, before, beforeEach, after } from "node:test";
import { addGamesToProcessingQueue, evaluateBettingOpportunity } from "../../src/services/bot.service.js";
import { initializeBrowser, closeBrowser } from "../../src/core/browser.js";

// Spy on console.log to capture log messages during the tests.
const consoleLogSpy = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
	consoleLogSpy.push(args.join(" "));
	originalConsoleLog(...args);
};

before(async () => {
	console.log("[Test Setup] Initializing browser for all tests...");
	await initializeBrowser();
});

// This `after` hook runs once after all tests in this file have completed.
after(async () => {
	console.log("[Test Teardown] Closing browser...");
	await closeBrowser();
});

test("Bot Service Tests", async (t) => {
	await initializeBrowser();

	t.beforeEach(() => {
		consoleLogSpy.length = 0;
		mock.restoreAll();
	});

	await t.test("Football Moneyline - Standard", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Moneyline - Standard) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "money_line",
				outcome: "home",
				priceHome: 2.0,
				priceAway: 3.5,
				priceDraw: 3.0,
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "1X2",
					selections: [
						{ name: "1", status: "VALID", odd: { value: 2.2 } },
						{ name: "X", status: "VALID", odd: { value: 3.0 } },
						{ name: "2", status: "VALID", odd: { value: 3.5 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Moneyline - Standard) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Moneyline - Missing Price", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Moneyline - Missing Price) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "money_line",
				outcome: "home",
				priceHome: 2.0,
				priceAway: 3.5,
				priceDraw: null, // Missing draw price
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "1X2",
					selections: [
						{ name: "1", status: "VALID", odd: { value: 2.2 } },
						{ name: "X", status: "VALID", odd: { value: 3.0 } },
						{ name: "2", status: "VALID", odd: { value: 3.5 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Moneyline - Missing Price) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Moneyline - Invalid Odds", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Moneyline - Invalid Odds) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "money_line",
				outcome: "home",
				priceHome: 0, // Invalid odds
				priceAway: 3.5,
				priceDraw: 3.0,
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "1X2",
					selections: [
						{ name: "1", status: "VALID", odd: { value: 2.2 } },
						{ name: "X", status: "VALID", odd: { value: 3.0 } },
						{ name: "2", status: "VALID", odd: { value: 3.5 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Moneyline - Invalid Odds) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	// Football Total Tests
	await t.test("Football Total - Both Prices", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Total - Both Prices) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "total",
				outcome: "under",
				priceOver: 2.0,
				priceUnder: 1.8,
				points: "2.5",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Total Goals 2.5",
					specialValue: "2.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.94 } },
						{ name: "Under", status: "VALID", odd: { value: 1.74 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Total - Both Prices) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Total - Missing PriceOver", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Total - Missing PriceOver) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "total",
				outcome: "under",
				priceOver: null,
				priceUnder: 2.54,
				points: "2.5",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Total Goals 2.5",
					specialValue: "2.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.94 } },
						{ name: "Under", status: "VALID", odd: { value: 1.74 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Total - Missing PriceOver) ---");
		console.log(JSON.stringify(result, null, 2));
		t.ok(result, "Should return a non-null result using raw odds");
	});

	await t.test("Football Total - Invalid PriceUnder", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Total - Invalid PriceUnder) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "total",
				outcome: "under",
				priceOver: 2.0,
				priceUnder: "invalid",
				points: "2.5",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Total Goals 2.5",
					specialValue: "2.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.94 } },
						{ name: "Under", status: "VALID", odd: { value: 1.74 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Total - Invalid PriceUnder) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Total - Points Mismatch", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Total - Points Mismatch) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "total",
				outcome: "under",
				priceOver: 2.0,
				priceUnder: 1.8,
				points: "2", // Mismatch with bookmaker's 2.5
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Total Goals 2.5",
					specialValue: "2.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.94 } },
						{ name: "Under", status: "VALID", odd: { value: 1.74 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Total - Points Mismatch) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	// Football Spread Tests
	await t.test("Football Spread - Draw No Bet", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Spread - Draw No Bet) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "spread",
				outcome: "home",
				priceHome: 2.36,
				priceAway: 1.55,
				points: "0",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Draw No Bet",
					specialValue: "0",
					selections: [
						{ name: "1 DNB", status: "VALID", odd: { value: 2.5 } },
						{ name: "2 DNB", status: "VALID", odd: { value: 1.55 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Spread - Draw No Bet) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Spread - Handicap Negative Points", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Spread - Handicap Negative Points) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "spread",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-1",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Handicap -1",
					specialValue: "0:1",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 2.0 } },
						{ name: "Away", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Spread - Handicap Negative Points) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Spread - Handicap Positive Points", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Spread - Handicap Positive Points) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "spread",
				outcome: "away",
				priceHome: 1.8,
				priceAway: 2.0,
				points: "1",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Handicap 1",
					specialValue: "0:1",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 1.8 } },
						{ name: "Away", status: "VALID", odd: { value: 2.0 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Spread - Handicap Positive Points) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Football Spread - Quarter-Goal Handicap", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Football Spread - Quarter-Goal Handicap) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "spread",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-0.5",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Handicap -0.5",
					specialValue: "0:0.5",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 2.0 } },
						{ name: "Away", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Football Spread - Quarter-Goal Handicap) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	// Basketball Total Tests
	await t.test("Basketball Total - Both Prices", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Total - Both Prices) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "total",
				outcome: "over",
				priceOver: 1.85,
				priceUnder: 1.95,
				points: "180.5",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Total (Incl. Overtime) 180.5",
					specialValue: "180.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.95 } },
						{ name: "Under", status: "VALID", odd: { value: 1.75 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Total - Both Prices) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Basketball Total - Missing PriceUnder", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Total - Missing PriceUnder) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "total",
				outcome: "over",
				priceOver: 1.85,
				priceUnder: null,
				points: "180.5",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Total (Incl. Overtime) 180.5",
					specialValue: "180.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.95 } },
						{ name: "Under", status: "VALID", odd: { value: 1.75 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Total - Missing PriceUnder) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Basketball Total - Invalid Points", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Total - Invalid Points) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "total",
				outcome: "over",
				priceOver: 1.85,
				priceUnder: 1.95,
				points: "invalid",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Total (Incl. Overtime) 180.5",
					specialValue: "180.5",
					selections: [
						{ name: "Over", status: "VALID", odd: { value: 1.95 } },
						{ name: "Under", status: "VALID", odd: { value: 1.75 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Total - Invalid Points) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	// Basketball Spread Tests
	await t.test("Basketball Spread - Draw No Bet", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Spread - Draw No Bet) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "spread",
				outcome: "away",
				priceHome: 1.9,
				priceAway: 2.0,
				points: "0",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "DNB RT",
					specialValue: "0",
					selections: [
						{ name: "1 DNB", status: "VALID", odd: { value: 1.9 } },
						{ name: "2 DNB", status: "VALID", odd: { value: 2.1 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Spread - Draw No Bet) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Basketball Spread - Handicap Negative Points", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Spread - Handicap Negative Points) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "spread",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-5.5",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Handicap (Incl. Overtime) -5.5",
					specialValue: "0 : 5.5",
					selections: [
						{ name: "1 AH", status: "VALID", odd: { value: 2.0 } },
						{ name: "2 AH", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Spread - Handicap Negative Points) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Basketball Spread - Handicap Positive Points", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Spread - Handicap Positive Points) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "spread",
				outcome: "away",
				priceHome: 1.8,
				priceAway: 2.0,
				points: "5.5",
				periodNumber: "0",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Handicap (Incl. Overtime) 5.5",
					specialValue: "0 : 5.5",
					selections: [
						{ name: "1 AH", status: "VALID", odd: { value: 1.8 } },
						{ name: "2 AH", status: "VALID", odd: { value: 2.0 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Spread - Handicap Positive Points) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Basketball Spread - Non-Zero Period", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Basketball Spread - Non-Zero Period) ---");
		const mockData = {
			providerData: {
				sportId: "3",
				lineType: "spread",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-5.5",
				periodNumber: "1", // Unsupported period
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Handicap (Incl. Overtime) -5.5",
					specialValue: "0 : 5.5",
					selections: [
						{ name: "1 AH", status: "VALID", odd: { value: 2.0 } },
						{ name: "2 AH", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Basketball Spread - Non-Zero Period) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	// Edge Cases
	await t.test("Edge Case - Unsupported Line Type", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Edge Case - Unsupported Line Type) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "invalid_type",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Handicap -1",
					specialValue: "0:1",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 2.0 } },
						{ name: "Away", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Edge Case - Unsupported Line Type) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Edge Case - Unsupported Sport ID", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Edge Case - Unsupported Sport ID) ---");
		const mockData = {
			providerData: {
				sportId: "99", // Unsupported sport
				lineType: "spread",
				outcome: "home",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-1",
				home: "Team A",
				away: "Team B"
			},
			bookmakerMatch: {
				name: "Team A vs Team B",
				markets: [{
					name: "Handicap -1",
					specialValue: "0:1",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 2.0 } },
						{ name: "Away", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Edge Case - Unsupported Sport ID) ---");
		console.log(JSON.stringify(result, null, 2));
	});

	await t.test("Edge Case - Invalid Selection Name", async () => {
		console.log("\n--- RUNNING TEST: evaluateBettingOpportunity (Edge Case - Invalid Selection Name) ---");
		const mockData = {
			providerData: {
				sportId: "1",
				lineType: "spread",
				outcome: "invalid_outcome",
				priceHome: 1.9,
				priceAway: 1.9,
				points: "-1",
				home: "Barrow",
				away: "Bolton Wanderers"
			},
			bookmakerMatch: {
				name: "Barrow vs Bolton Wanderers",
				markets: [{
					name: "Handicap -1",
					specialValue: "0:1",
					selections: [
						{ name: "Home", status: "VALID", odd: { value: 2.0 } },
						{ name: "Away", status: "VALID", odd: { value: 1.8 } }
					]
				}]
			}
		};
		const result = await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);
		console.log("--- RESULT for evaluateBettingOpportunity (Edge Case - Invalid Selection Name) ---");
		console.log(JSON.stringify(result, null, 2));
	});


	await t.test("Integration Test: Full Workflow (Live)", { skip: true }, { timeout: 90000 }, async () => {
		console.log("\n--- RUNNING TEST: Full Workflow (Live) ---");
		const realProviderData = [
			{
				"id": "test-moneyline-ostersunds-001",
				"sportId": "1",
				"minDropPercent": "14",
				"timeIntervalMs": "210000",
				"maxTimeToMatchStartMs": "21600000",
				"lowerBoundOdds": "1.5",
				"upperBoundOdds": "3.0",
				"nickname": "soccer(test)",
				"includeMoneyline": "1",
				"includeSpreads": "1",
				"includeTotals": "1",
				"percentageChange": "15.00",
				"changeFrom": "2.50",
				"changeTo": "2.10",
				"eventId": "1611563532",
				"periodNumber": "0",
				// --- CORE CHANGES ---
				"lineType": "money_line",
				"points": "", // Points are not used for money line
				"outcome": "away",
				"priceHome": "2.8",
				"priceAway": "2.10",
				"priceDraw": "3.4",
				// --- END OF CORE CHANGES ---
				"timestamp": "1752592803511",
				"leagueName": "Superettan",
				"home": "Ostersunds FK",
				"away": "Helsingborgs IF",
				"noVigPrice": "",
				"starts": "1754247600000",
				"type": "oddsDrop",
				"alertingCriteriaId": "alertingCriteria:a62hxf9dxfnf7exeo2ne3rid",
				"userId": "user_2tx1tBtUOvXZXyUU8BaQ5Bpy15W",
				"lowerBoundLimit": "150",
				"upperBoundLimit": "100000",
				"includeOrExcludeCompetitions": "include",
				"enabled": "1",
				"changeDirection": "increase",
				"includePeriod0": "1",
				"includePeriod1": "1"
			}
		];

		// ACT: Start the process with real provider data.
		addGamesToProcessingQueue(realProviderData);

		// Wait for the process to complete by checking if our mock was called.
		await new Promise((resolve, reject) => {
			const timeout = setTimeout(() => reject(new Error("Test timed out waiting for placeBet to be called.")), 80000);
			const interval = setInterval(() => {
				if (placeBetIntegrationMock.mock.callCount() > 0) {
					clearInterval(interval);
					clearTimeout(timeout);
					resolve();
				}
			}, 500);
		});

		console.log("--- RESULT for Full Workflow (Live) ---");
		console.log(`placeBet was called ${placeBetIntegrationMock.mock.callCount()} time(s).`);
	});


	// Close the browser instance after all tests in this file are done.
	t.after(async () => {
		await closeBrowser();
	});
});

