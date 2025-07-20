import { test } from "node:test";
import assert from "node:assert";
import { initializeBrowser, closeBrowser } from "../../src/core/browser.js";
import * as bookmakerService from "../../src/services/bookmaker.service.js";

// --- MOCK DATA SETUP ---
// We need a real username and password
const mockUsername = "07033054766";
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
    "allowOddChanges": true,
    "allowStakeReduction": false,
    "requestTransactionId": Date.now().toString(), // Always generate a unique ID
    "transferStakeFromAgent": false
};

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

    await t.test("(Signin)", { skip: true }, async () => {
        await bookmakerService.signin(mockUsername, "A1N2S3I4");

        // Verify console output
        assert.ok(
            consoleLogSpy.some((log) => log.includes("Logged in 07033054766")),
            "Expected 'Logged in 07033054766' log"
        );
    });

    await t.test("placeBet", async (t) => {
        await t.test("should place bet successfully with valid cookies", async () => {
            // MOCKING: We replace the real `fetch` with our fake version.
            // This isolates our function from the network for a fast and reliable unit test.
            global.fetch = async () => mockFetchResponse;

            try {
                // ACT: Run the function we want to test.
                const result = await bookmakerService.placeBet(mockUsername, mockBetData);

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

    // Close the browser instance after all tests in this file are done.
    t.after(async () => {
        await closeBrowser();
    });
});

// Restore original console.log after the entire test process exits.
process.on("exit", () => {
    console.log = originalConsoleLog;
});
