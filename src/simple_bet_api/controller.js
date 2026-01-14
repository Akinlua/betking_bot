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
    const leagueName = normalize(matchDetails?.league?.name || matchDetails?.leagueName || "");

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
 */
function shouldExcludeSpread(selection, market_type) {
    if (market_type !== "spread" && market_type !== "handicap") {
        return false;
    }

    const specialValue = String(selection.specialValue || "");

    // Exclude -0.5 spread (appears as "0 : 0.5" for away in football)
    if (specialValue.includes("0 : 0.5") || specialValue.includes("0:0.5")) {
        return true;
    }

    // Exclude 0 spread (DNB - Draw No Bet)
    if (specialValue === "0" || normalize(selection.name).includes("dnb")) {
        return true;
    }

    return false;
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

    // Filter markets by name
    let candidateMarkets = markets.filter(m => {
        const mName = normalize(m.name);

        if (market_type === "team_totals") {
            const hasTotal = mName.includes("total");
            // Check for specific team if provided, otherwise match any team
            const hasTeam = team ? mName.includes(team) : (mName.includes("home") || mName.includes("away"));
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

    // 2. Find Selection within Candidate Markets
    for (const market of candidateMarkets) {
        const selections = market.selections || [];

        for (const sel of selections) {
            const sName = normalize(sel.name);
            const targetOutcome = normalize(outcome);

            let nameMatch = false;

            // First half selections use "HT" suffix (e.g., "1 HT", "X HT", "2 HT")
            // Regular selections use plain names (e.g., "1", "X", "2", "Home", "Away")
            if (targetOutcome === "home" || targetOutcome === "1") {
                nameMatch = sName === "home" || sName === "1" || sName === "1 ht";
            } else if (targetOutcome === "away" || targetOutcome === "2") {
                nameMatch = sName === "away" || sName === "2" || sName === "2 ht";
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

            // Check spread exclusions
            if (shouldExcludeSpread(sel, market_type)) {
                continue; // Skip this selection
            }

            if (points !== undefined && points !== null) {
                const selLine = sel.specialValue || sel.line;
                if (String(selLine).includes(String(points))) {
                    return { market, selection: sel };
                }
            } else {
                return { market, selection: sel };
            }
        }
    }

    throw new Error(`No selection found for outcome '${outcome}' with points '${points}' in markets matching '${market_type}'`);
}


export async function placeBet(req, res) {
    const {
        home,
        away,
        stake = 10,
        username,
        market_type = "moneyline",
        outcome,
        points,
        is_first_half = false,
        team // "home" or "away" for team_totals
    } = req.body;

    if (!home || !away) {
        return res.status(400).json({ error: "Missing 'home' or 'away' team names." });
    }

    if (market_type !== "moneyline" && !outcome) {
        return res.status(400).json({ error: "Outcome is required for this market type." });
    }

    const { browser } = req;

    // Determine user context
    const userToUse = username || process.env.BETKING_USERNAME;
    if (!userToUse) {
        return res.status(400).json({ error: "Username is required (or env default) to load session." });
    }

    try {
        console.log(chalk.cyan(`[SimpleAPI] Processing bet for user: ${userToUse}`));

        // 1. Load User Store
        const store = new Store(userToUse);
        await store.initialize();

        // 2. Initialize Bookmaker with stored session
        // Note: Password might not be needed if session is valid.
        // If we need to re-login, we need the password.
        const data = store.getData();
        const storedCreds = data.credentials || {};
        const passwordToUse = storedCreds.password || process.env.BETKING_PASSWORD;

        const bookmakerConf = {
            name: "BetKing",
            username: userToUse,
            password: passwordToUse || "", // Might be empty if not saved
        };

        const bookmaker = new BetKingBookmaker(bookmakerConf, browser, store);

        // 3. Verify Session
        // "doesn't bother about login just take cookies"
        // But we should verify if cookies are valid.
        const valid = await bookmaker.getBookmakerSessionValidity();

        if (!valid) {
            console.log(chalk.yellow(`[SimpleAPI] Session invalid for ${userToUse}. Attempting auto-login...`));
            if (passwordToUse) {
                const loginRes = await bookmaker.signin(userToUse, passwordToUse);
                if (!loginRes.success) {
                    return res.status(401).json({ error: "Session invalid and auto-login failed", details: loginRes.error });
                }
                console.log(chalk.green(`[SimpleAPI] Auto-login successful.`));
            } else {
                return res.status(401).json({ error: "Session invalid and no password saved for auto-login." });
            }
        } else {
            console.log(chalk.green(`[SimpleAPI] Session valid for ${userToUse}. Proceeding...`));
        }

        // 4. Find Match and Place Bet
        console.log(chalk.cyan(`[SimpleAPI] Searching match: ${home} vs ${away}`));
        const matchItem = await bookmaker.getMatchDataByTeamPair(home, away);
        if (!matchItem) {
            return res.status(404).json({ error: "Match not found by team names." });
        }

        const eventId = matchItem.IDEvent ?? matchItem.id;
        const eventName = matchItem.EventName ?? matchItem.eventName ?? `${matchItem.TeamHome} - ${matchItem.TeamAway}`;

        console.log(chalk.cyan(`[SimpleAPI] Fetching event details: id=${eventId}, name=${eventName}`));
        const matchDetails = await bookmaker.getMatchDetailsByEvent(eventId, eventName);
        if (!matchDetails) {
            return res.status(500).json({ error: "Failed to fetch match details." });
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
            return res.status(400).json({ error: `Could not find specified market/selection: ${e.message}` });
        }

        const { market, selection } = selectionData;
        console.log(chalk.green(`[SimpleAPI] Found Market="${market.name}" Selection="${selection.name}" @ ${selection.odd.value}`));

        const providerData = { sportId: 1 };

        const payload = bookmaker.constructBetPayload(
            matchDetails,
            market,
            selection,
            Number(stake),
            providerData
        );

        const betResult = await bookmaker.placeBet(userToUse, payload);

        // BetKing returns responseStatus: 1 for success
        if (betResult.responseStatus === 1) {
            return res.json({
                status: "success",
                match: eventName,
                market: market.name,
                selection: selection.name,
                odds: selection.odd.value,
                result: betResult
            });
        } else {
            const errorMsg = betResult.errorsList ? JSON.stringify(betResult.errorsList) : `Status: ${betResult.responseStatus}`;
            return res.status(400).json({ status: "failed", error: `Bet rejected: ${errorMsg}` });
        }

    } catch (error) {
        console.error(chalk.red("[SimpleAPI] Error processing bet:"), error);
        return res.status(500).json({ error: error.message });
    }
}
