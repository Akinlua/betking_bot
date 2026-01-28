import BetKingBookmaker from "./src/interfaces/bookmakers/betking/index.js";
import puppeteer from "puppeteer-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

puppeteer.use(StealthPlugin());

// Mock Config & Store
const mockConfig = { isLive: true };
const mockStore = {
    // Add any store methods if needed, mostly empty for this specific test
    getBookmakerCookies: () => [],
};

async function initializeBrowser() {
    console.log("[Test] Launching browser...");
    const browser = await puppeteer.launch({
        headless: true, // Set to false if you want to see the browser
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
        ],
    });
    return browser;
}

async function runTests() {
    const homeTeam = process.argv[2];
    const awayTeam = process.argv[3];

    if (!homeTeam || !awayTeam) {
        console.log("Usage: node test_match_search.js <Home Team> <Away Team>");
        console.log("Example: node test_match_search.js 'Manchester City' 'Liverpool'");
        process.exit(1);
    }

    let browser;
    try {
        browser = await initializeBrowser();
        console.log("[Test] Browser launched.");

        const bookmaker = new BetKingBookmaker(mockConfig, browser, mockStore);

        console.log(`[Test] Searching for match: "${homeTeam}" vs "${awayTeam}"...`);

        const startTime = Date.now();
        const match = await bookmaker.getMatchDataByTeamPair(homeTeam, awayTeam);
        const duration = (Date.now() - startTime) / 1000;

        console.log(`[Test] Search completed in ${duration}s`);

        if (match) {
            console.log("\n✅ MATCH FOUND:");
            console.log("---------------------------------------------------");
            console.log(`Event Name: ${match.EventName}`);
            console.log(`Event ID:   ${match.id || match.IDEvent}`);
            console.log(`Score:      ${match.Score} (Fuzzy Match Confidence)`);
            console.log(`Scores:     ${match.matchScore || 'N/A'}`);
            console.log("---------------------------------------------------");
        } else {
            console.log("\n❌ MATCH NOT FOUND in Live Matches.");
        }

    } catch (error) {
        console.error("[Test] Error during execution:", error);
    } finally {
        if (browser) {
            console.log("[Test] Closing browser...");
            await browser.close();
        }
    }
}

runTests();
