import BetKingBookmaker from "../interfaces/bookmakers/betking/index.js";
import { Store } from "../bots/edgerunner/store.js";
import chalk from "chalk";
import path from 'path'
import fs from 'fs';

function normalize(s) {
    return String(s || "").toLowerCase();
}

/**
 * Checks if a league should be excluded based on market type
 */
function shouldExcludeLeague(matchDetails, market_type) {
    const leagueName = normalize(matchDetails?.tournamentName || matchDetails?.leagueName || "");

    console.log(`League name: ${leagueName}`)
    // Handicap & Moneyline: Exclude CUP and WOMEN
    if (market_type === "moneyline" || market_type === "spread" || market_type === "handicap") {
        if (leagueName.includes("cup") || leagueName.includes("women")) {
            return true;
        }
    }

    // Total & Team Totals: Exclude WOMEN
    if (market_type === "total" || market_type === "totals" || market_type === "team_totals") {
        if (leagueName.includes("women")) {
            return true;
        }
    }

    return false;
}

/**
 * Checks if a spread/handicap selection should be excluded
 * Returns a string reason if excluded, or null if allowed.
 */
function getExclusionReason(selection, market, market_type) {
    if (market_type !== "spread" && market_type !== "handicap") {
        return null;
    }

    // For handicaps, the line value is on the market, not the selection
    const marketLine = String(market.specialValue || market.line || "");
    const selectionValue = String(selection.specialValue || "");

    // Check both market and selection for the line value
    const specialValue = marketLine || selectionValue;

    // Exclude -0.5 spread (can appear as "-0.5", "0:0.5", or "0 : 0.5")
    if (specialValue.includes("-0.5") || specialValue.includes("0:0.5") || specialValue.includes("0 : 0.5")) {
        return "Spread -0.5 is excluded by policy.";
    }

    // Exclude 0 spread (DNB - Draw No Bet)
    if (specialValue === "0" || normalize(selection.name).includes("dnb")) {
        return "Spread 0 (DNB) is excluded by policy.";
    }

    return null;
}

/**
 * Finds the correct market and selection based on the detailed criteria.
 */
function findMarketAndSelection(matchDetails, criteria) {
    const { market_type, outcome, points, is_first_half, team } = criteria;
    const rawMarkets = Array.isArray(matchDetails?.markets) ? matchDetails.markets : [];

    // Flatten markets to include spreadMarkets
    const markets = [];
    rawMarkets.forEach(m => {
        markets.push(m);
        if (m.spreadMarkets && Array.isArray(m.spreadMarkets)) {
            m.spreadMarkets.forEach(sm => markets.push(sm));
        }
    });

    // Debug: Write match details to file
    const debugData = {
        timestamp: new Date().toISOString(),
        matchDetails: matchDetails,
        markets: markets,
        criteria: criteria
    };
    const debugFilePath = path.join(process.cwd(), 'bet_debug.json');
    fs.writeFileSync(debugFilePath, JSON.stringify(debugData, null, 2));
    console.log("Debug data written to", debugFilePath);

    if (!markets.length) throw new Error("No markets found in match details.");

    // Check league exclusions
    if (shouldExcludeLeague(matchDetails, market_type)) {
        const leagueName = matchDetails?.league?.name || matchDetails?.leagueName || "Unknown";
        throw new Error(`League "${leagueName}" is excluded for ${market_type} bets`);
    }

    let targetMarketName = "";

    // 1. Determine target market name pattern
    switch (market_type) {
        case "moneyline":
            targetMarketName = is_first_half ? "1st half - 1x2" : "1x2";
            break;
        case "spread":
        case "handicap":
            targetMarketName = is_first_half ? "1st half - handicap" : "handicap";
            break;
        case "total":
        case "totals":
            targetMarketName = is_first_half ? "1st half - total" : "total";
            break;
        case "team_totals":
            targetMarketName = is_first_half ? "1st half - home team total" : "home team total";
            break;
        default:
            targetMarketName = market_type;
    }

    // Extract team names from matchDetails for team_totals matching
    const homeTeamName = matchDetails?.homeTeam || matchDetails?.name?.split(' - ')[0] || "";
    const awayTeamName = matchDetails?.awayTeam || matchDetails?.name?.split(' - ')[1] || "";

    // Filter markets by name
    let candidateMarkets = markets.filter(m => {
        const mName = normalize(m.name);

        // Exclude corner markets unless explicitly requested (future proofing)
        if (mName.includes("corner")) {
            return false;
        }

        if (market_type === "team_totals") {
            const hasTotal = mName.includes("total");

            // Check for specific team if provided
            let hasTeam = false;
            if (team) {
                if (is_first_half) {
                    // First-half markets use actual team names: "1st Half - JS Kairouanaise Total Goals"
                    const targetTeam = team === "home" ? homeTeamName : (team === "away" ? awayTeamName : team);
                    hasTeam = mName.includes(normalize(targetTeam));
                } else {
                    // Regular markets use "home"/"away" keywords: "Total Goals Home"
                    hasTeam = mName.includes(team);
                }
            } else {
                // If no team specified, match any team total market
                if (is_first_half) {
                    hasTeam = mName.includes(normalize(homeTeamName)) || mName.includes(normalize(awayTeamName));
                } else {
                    hasTeam = mName.includes("home") || mName.includes("away");
                }
            }

            const halfMatch = is_first_half ?
                (mName.includes("1st half") || mName.includes("1st-half") || mName.includes("first half")) :
                !(mName.includes("1st half") || mName.includes("1st-half") || mName.includes("first half"));
            return hasTotal && hasTeam && halfMatch;
        }

        // General matching with improved first half detection
        const halfMatch = is_first_half ?
            (mName.includes("1st half") || mName.includes("1st-half") || mName.includes("first half")) :
            !(mName.includes("1st half") || mName.includes("1st-half") || mName.includes("first half"));



        if (market_type === "moneyline") {
            // Check if market name contains 1x2/moneyline AND matches half criteria
            const isMoneyline = mName.includes("1x2") || mName.includes("moneyline") || mName.includes("match winner");

            // Special handling for "HT 1X2" markets (HT = Half Time)
            if (is_first_half && mName.startsWith("ht ") && isMoneyline) {
                return true;
            }

            return isMoneyline && halfMatch;
        }

        if (market_type === "total") {
            // Check if market name contains total AND matches half criteria
            const isTotal = (mName.includes("total") && mName.includes("goal")) || mName === "total" || mName === "totals";
            return isTotal && halfMatch;
        }

        if (market_type === "spread") {
            return (mName.includes("handicap")) && halfMatch;
        }

        return mName.includes(normalize(targetMarketName));
    });

    if (candidateMarkets.length === 0) {
        candidateMarkets = markets.filter(m => normalize(m.name).includes(normalize(market_type)));
    }

    if (candidateMarkets.length === 0) throw new Error(`No markets found matching type '${market_type}' (Half: ${is_first_half})`);

    let rejectionReason = null;

    // 2. Find Selection within Candidate Markets
    for (const market of candidateMarkets) {
        const selections = market.selections || [];

        for (const sel of selections) {
            const sName = normalize(sel.name);
            const targetOutcome = normalize(outcome);

            let nameMatch = false;

            // First half selections use "HT" suffix (e.g., "1 HT", "X HT", "2 HT")
            // Regular selections use plain names (e.g., "1", "X", "2", "Home", "Away")
            // Asian Handicap selections use "1 AH", "2 AH"
            if (targetOutcome === "home" || targetOutcome === "1") {
                nameMatch = sName === "home" || sName === "1" || sName === "1 ht" || sName === "1 ah";
            } else if (targetOutcome === "away" || targetOutcome === "2") {
                nameMatch = sName === "away" || sName === "2" || sName === "2 ht" || sName === "2 ah";
            } else if (targetOutcome === "draw" || targetOutcome === "x") {
                nameMatch = sName === "draw" || sName === "x" || sName === "x ht";
            } else if (targetOutcome === "over") {
                nameMatch = sName.includes("over");
            } else if (targetOutcome === "under") {
                nameMatch = sName.includes("under");
            } else {
                nameMatch = sName.includes(targetOutcome);
            }

            if (!nameMatch) continue;

            // Check points if required
            let pointsMatch = true;
            if (points !== undefined && points !== null) {
                // Points are stored at the market level (specialValue, specifier, or line)
                // NOT on individual selections
                const marketLine = market.specialValue || market.line || (market.specifier ? market.specifier.replace('line=', '') : '');

                if (marketLine) {
                    // String match - check if the market line contains the requested points
                    pointsMatch = String(marketLine).includes(String(points));
                } else {
                    // No line info on market - this market doesn't match
                    pointsMatch = false;
                }
            }

            if (!pointsMatch) continue;

            // Check spread exclusions for this matched candidate
            const reason = getExclusionReason(sel, market, market_type);
            if (reason) {
                rejectionReason = reason;
                continue; // Skip this excluded one, keep looking for others
            }

            return { market, selection: sel };
        }
    }

    if (rejectionReason) {
        throw new Error(`Selection found but excluded: ${rejectionReason}`);
    }

    throw new Error(`No selection found for outcome '${outcome}' with points '${points}' in markets matching '${market_type}'`);
}


export async function placeBet(req, res) {
    const {
        home,
        away,
        market_type = "moneyline",
        outcome,
        points,
        is_first_half = false,
        team, // "home" or "away" for team_totals
        odds: expected_odds
    } = req.body;

    if (!home || !away) {
        return res.status(400).json({ error: "Missing 'home' or 'away' team names." });
    }

    if (market_type !== "moneyline" && !outcome) {
        return res.status(400).json({ error: "Outcome is required for this market type." });
    }

    if (market_type === "spread" || market_type === "handicap") {
        return res.status(400).json({ error: "Spread/Handicap betting is disabled on this instance." });
    }

    const { browser } = req;

    // Resolve relative to this file
    const __dirname = path.dirname(new URL(import.meta.url).pathname);
    const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");
    let accounts = [];
    try {
        const accountsData = fs.readFileSync(ACCOUNTS_FILE, 'utf-8');
        accounts = JSON.parse(accountsData);
    } catch (error) {
        console.error(chalk.red("[SimpleAPI] Failed to read accounts.json:"), error);
        return res.status(500).json({ error: "Failed to load accounts configuration." });
    }

    if (!Array.isArray(accounts) || accounts.length === 0) {
        return res.status(400).json({ error: "No accounts configured in accounts.json" });
    }

    console.log(chalk.magenta(`[SimpleAPI] Starting parallel bet placement for ${accounts.length} accounts...`));

    const results = await Promise.all(accounts.map(async (account) => {
        const userToUse = account.username;
        const stake = account.stake || 50; // Default stake if missing

        try {
            console.log(chalk.cyan(`[SimpleAPI] Processing bet for user: ${userToUse}`));

            // 1. Load User Store
            const store = new Store(userToUse);
            await store.initialize();

            // 2. Initialize Bookmaker
            const data = store.getData();
            const storedCreds = data.credentials || {};
            // Use password from account config if not in store (though auth service should have synced it)
            const passwordToUse = account.password || storedCreds.password || process.env.BETKING_PASSWORD;

            const bookmakerConf = {
                name: "BetKing",
                username: userToUse,
                password: passwordToUse || "",
                isLive: true
            };

            const bookmaker = new BetKingBookmaker(bookmakerConf, browser, store);

            // 3. Verify Session
            const valid = await bookmaker.getBookmakerSessionValidity();

            if (!valid) {
                console.log(chalk.yellow(`[SimpleAPI] Session invalid for ${userToUse}. Attempting auto-login...`));
                if (passwordToUse) {
                    const loginRes = await bookmaker.signin(userToUse, passwordToUse);
                    if (!loginRes.success) {
                        throw new Error(`Session invalid and auto-login failed: ${loginRes.error}`);
                    }
                    console.log(chalk.green(`[SimpleAPI] Auto-login successful for ${userToUse}.`));
                } else {
                    throw new Error("Session invalid and no password available for auto-login.");
                }
            }

            // 4. Find Match and Place Bet
            // console.log(chalk.cyan(`[SimpleAPI] Searching match: ${home} vs ${away}`));
            const matchItem = await bookmaker.getMatchDataByTeamPair(home, away);
            if (!matchItem) {
                throw new Error("Match not found by team names.");
            }

            const eventId = matchItem.IDEvent ?? matchItem.id;
            const eventName = matchItem.EventName ?? matchItem.eventName ?? `${matchItem.TeamHome} - ${matchItem.TeamAway}`;

            // console.log(chalk.cyan(`[SimpleAPI] Fetching event details: id=${eventId}, name=${eventName}`));
            const matchDetails = await bookmaker.getMatchDetailsByEvent(eventId, eventName);
            if (!matchDetails) {
                throw new Error("Failed to fetch match details.");
            }

            let selectionData;
            try {
                selectionData = findMarketAndSelection(matchDetails, {
                    market_type,
                    outcome,
                    points,
                    is_first_half,
                    team
                });
            } catch (e) {
                throw new Error(`Could not find specified market/selection: ${e.message}`);
            }

            const { market, selection } = selectionData;

            const found_odds = selection.odd.value;

            // Validate minimum odds constraint
            if (found_odds && found_odds < 1.5) {
                console.warn(chalk.yellow(`[SimpleAPI][${userToUse}] Odds too low: Found odds ${found_odds} is below minimum of 1.5`));
                throw new Error(`Found odds ${found_odds} is below minimum allowed odds of 1.5`);
            }
            // Validate maximum odds constraint
            if (found_odds && found_odds > 3.0) {
                console.warn(chalk.yellow(`[SimpleAPI][${userToUse}] Odds too high: Found odds ${found_odds} exceeds maximum of 3.0`));
                throw new Error(`Found odds ${found_odds} exceeds maximum allowed odds of 3.0`);
            }

            // Validate minimum 3% Expected Value (EV)
            // Constraint: api_odds * 1.03 <= betking_odds
            if (expected_odds) {
                const minRequiredOdds = expected_odds * 1.03;
                if (found_odds < minRequiredOdds) {
                    const evPercentage = ((found_odds / expected_odds - 1) * 100).toFixed(2);
                    console.warn(chalk.yellow(`[SimpleAPI][${userToUse}] Insufficient EV: found ${found_odds} (${evPercentage}% EV), required ${minRequiredOdds.toFixed(2)} (3% EV minimum)`));
                    throw new Error(`Insufficient Expected Value: found odds ${found_odds} with ${evPercentage}% EV, minimum 3% EV required (${minRequiredOdds.toFixed(2)})`);
                }
                console.log(`found odds ${found_odds} is greater than ${minRequiredOdds}`)
                const evPercentage = ((found_odds / expected_odds - 1) * 100).toFixed(2);
                console.log(chalk.green(`[SimpleAPI][${userToUse}] EV Check Passed: ${evPercentage}% EV (API: ${expected_odds}, BetKing: ${found_odds})`));
            }

            console.log(chalk.green(`[SimpleAPI][${userToUse}] Found Market="${market.name}" Selection="${selection.name}" @ ${selection.odd.value}`));

            const providerData = { sportId: 1 };

            const payload = bookmaker.constructBetPayload(
                matchDetails,
                market,
                selection,
                Number(stake),
                providerData
            );

            const betResult = await bookmaker.placeBet(userToUse, payload);

            if (betResult.responseStatus === 1) {
                return {
                    username: userToUse,
                    status: "success",
                    match: eventName,
                    market: market.name,
                    selection: selection.name,
                    odds: selection.odd.value,
                    result: betResult
                };
            } else {
                const errorMsg = betResult.errorsList ? JSON.stringify(betResult.errorsList) : `Status: ${betResult.responseStatus}`;
                throw new Error(`Bet rejected: ${errorMsg}`);
            }

        } catch (error) {
            console.error(chalk.red(`[SimpleAPI] Error processing bet for ${userToUse}:`), error.message);
            return {
                username: userToUse,
                status: "failed",
                error: error.message
            };
        }
    }));

    // Aggregate stats
    const successful = results.filter(r => r.status === "success").length;
    const failed = results.filter(r => r.status === "failed").length;

    console.log(chalk.magenta(`[SimpleAPI] Parallel bet execution finished. Success: ${successful}, Failed: ${failed}`));

    return res.json({
        summary: {
            total: results.length,
            successful,
            failed
        },
        results
    });
}
