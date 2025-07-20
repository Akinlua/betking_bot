import { test } from "node:test";
import assert from "node:assert";
import { evaluateBettingOpportunity } from "../../src/services/bot.service.js";

const consoleLogSpy = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
	consoleLogSpy.push(args.join(" "));
	originalConsoleLog(...args);
};

test("Evaluate Betting Opportunity", async (t) => {
	// Reset console spy before each test
	consoleLogSpy.length = 0;

	const mockData = {
		providerData: {
			id: "1752387717056-0",
			sportId: "1",
			minDropPercent: "14",
			timeIntervalMs: "210000",
			maxTimeToMatchStartMs: "86400000",
			lowerBoundOdds: "1.5",
			upperBoundOdds: "2.4",
			nickname: "Long-soccer(<2.4)",
			includeMoneyline: "1",
			includeSpreads: "1",
			lineType: "money_line",
			outcome: "home",
			priceHome: 2.0, // Provider odds for "home"
		},
		bookmakerMatch: {
			EventName: "Test Match",
			markets: [
				{
					name: "1x2",
					selections: [
						{
							name: "1",
							status: "VALID",
							odd: { value: 2.2 }, // Bookmaker odds for "home" (1)
						},
						{
							name: "x",
							status: "VALID",
							odd: { value: 3.0 },
						},
						{
							name: "2",
							status: "VALID",
							odd: { value: 3.5 },
						},
					],
				},
			],
		},
	};

	// Run the function
	await evaluateBettingOpportunity(mockData.bookmakerMatch, mockData.providerData);

	// Verify console output
	consoleLogSpy.some((log) => log.includes("Value bet: 10.00%")),
		"Expected a value bet with 10% edge"

	// Additional assertions (example)
	consoleLogSpy.some((log) => log.includes("Provider line type: 1x2")),
		"Expected provider line type to be logged"
});

// Restore original console.log after tests
process.on("exit", () => {
	console.log = originalConsoleLog;
});
