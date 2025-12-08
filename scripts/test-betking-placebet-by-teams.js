import puppeteer from "puppeteer-extra";
import stealthPlugin from "puppeteer-extra-plugin-stealth";
import chalk from "chalk";
import BetKingBookmaker from "../src/interfaces/bookmakers/betking/index.js";
import { Store } from "../src/bots/edgerunner/store.js";
import EdgeRunner from "../src/bots/edgerunner/index.js";

puppeteer.use(stealthPlugin());

function getArg(flag, def = undefined) {
  const idx = process.argv.indexOf(flag);
  if (idx !== -1 && idx + 1 < process.argv.length) return process.argv[idx + 1];
  return def;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

async function initBrowser() {
  const launchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--no-zygote",
      "--single-process",
      "--disable-extensions",
      "--disable-sync",
      "--disable-translate",
      "--mute-audio",
      "--no-first-run",
      "--disable-gpu",
      "--disable-dev-shm-usage",
      "--disable-http-cache",
      "--disable-background-networking",
      "--disable-features=site-per-process",
      "--disable-accelerated-2d-canvas",
      "--disable-background-timer-throttling",
      "--disable-client-side-phishing-detection",
    ],
    defaultTimeout: 60_000,
    protocolTimeout: 60_000,
  };
  const browser = await puppeteer.launch(launchOptions);
  console.log(chalk.green("[Test] Browser initialized."));
  return browser;
}

function pickMarketAndSelection(matchDetails) {
  const markets = Array.isArray(matchDetails?.markets) ? matchDetails.markets : [];
  if (!markets.length) throw new Error("No markets found in match details.");

  const normalize = (s) => String(s || "").toLowerCase();

  const totalsMarket = markets.find((m) => normalize(m.name).includes("total"));
  if (totalsMarket && Array.isArray(totalsMarket.selections)) {
    const isTargetLine = (sel) => {
      const val = String(sel?.specialValue ?? sel?.line ?? "");
      return val.includes("172.5");
    };
    let overSel = totalsMarket.selections.find((s) => normalize(s?.name) === "over" && isTargetLine(s));
    if (!overSel) overSel = totalsMarket.selections.find((s) => normalize(s?.name) === "over");
    if (overSel && overSel?.odd && typeof overSel.odd.value === "number") {
      return { market: totalsMarket, selection: overSel };
    }
  }

  const preferredNames = [
    "1x2",
    "full time result",
    "moneyline",
    "total goals",
    "totals",
    "handicap",
  ];

  // const normalize = (s) => String(s || "").toLowerCase();
  let market = markets.find((m) => preferredNames.some((p) => normalize(m.name).includes(p)));
  if (!market) market = markets.find((m) => Array.isArray(m.selections) && m.selections.length > 0);
  if (!market) throw new Error("No suitable market with selections found.");

  const selection = (market.selections || []).find((s) => s?.odd && typeof s.odd.value === "number") || market.selections?.[0];
  if (!selection) throw new Error("No selection with numeric odd value found.");

  return { market, selection };
}

async function main() {
  const home = getArg("--home");
  const away = getArg("--away");
  const username = getArg("--username");
  const password = getArg("--password");
  const stake = Number(getArg("--stake", "10"));
  const place = hasFlag("--place");
  const maxOdd = Number(getArg("--maxOdd", "1.2"));
  const includeSingle = hasFlag("--single");
  const includeMultiple = hasFlag("--multiple") || (!hasFlag("--single") && !hasFlag("--multiple"));
  const providerEventId = getArg("--providerEventId");
  const minValuePct = Number(getArg("--minValuePct", "5.5"));
  const minValueOdds = Number(getArg("--minValueOdds", "1.45"));
  const maxValueOdds = Number(getArg("--maxValueOdds", "3.5"));

  if (!home || !away) {
    console.error(chalk.red(
      "Usage: node scripts/test-betking-placebet-by-teams.js --home \"Team A\" --away \"Team B\" [--username USER --password PASS] [--stake 10] [--place] [--maxOdd 1.2] [--providerEventId 12345] [--minValuePct 5.5] [--minValueOdds 1.45] [--maxValueOdds 3.5] [--single] [--multiple]"
    ));
    process.exit(1);
  }

  const browser = await initBrowser();
  try {
    const store = new Store(username || "test-user");
    await store.initialize();

    const bookmakerConf = {
      name: "BetKing",
      username: username || "",
      password: password || "",
    };

    const bookmaker = new BetKingBookmaker(bookmakerConf, browser, store);

    // Ensure session for placing bets
    if (place) {
      const valid = await bookmaker.getBookmakerSessionValidity();
      if (!valid) {
        if (!username || !password) {
          throw new Error("Placing a bet requires --username and --password or a valid saved session.");
        }
        console.log(chalk.yellow("[Test] Session invalid or missing. Signing in..."));
        const res = await bookmaker.signin(username, password);
        if (!res.success) throw new Error(`Sign-in failed: ${res.error}`);
      }
    }

    console.log(chalk.cyan(`[Test] Searching match: ${home} vs ${away}`));
    const matchItem = await bookmaker.getMatchDataByTeamPair(home, away);
    if (!matchItem) throw new Error("Match not found by team names.");

    const eventId = matchItem.IDEvent ?? matchItem.id;
    const eventName = matchItem.EventName ?? matchItem.eventName ?? `${matchItem.TeamHome} - ${matchItem.TeamAway}`;
    console.log(chalk.cyan(`[Test] Fetching event details: id=${eventId}, name=${eventName}`));
    const matchDetails = await bookmaker.getMatchDetailsByEvent(eventId, eventName);
    if (!matchDetails) throw new Error("Failed to fetch match details from event page.");

    let { market, selection } = pickMarketAndSelection(matchDetails);
    console.log(chalk.green(`[Test] Initial pick market="${market.name}" selection="${selection.name}" @ ${selection.odd.value}`));

    // If provider event id is supplied, use evaluateMarket to select the best value bet
    if (providerEventId) {
      try {
        const edgeRunnerConfig = {
          bookmaker: { name: "betking", username: username || "", password: password || "" },
          provider: { name: "pinnacle" },
          edgerunner: {
            minValueBetPercentage: isNaN(minValuePct) ? 0 : minValuePct,
            minValueBetOdds: isNaN(minValueOdds) ? 1 : minValueOdds,
            maxValueBetOdds: isNaN(maxValueOdds) ? Infinity : maxValueOdds,
          },
        };
        const edgeRunner = new EdgeRunner(edgeRunnerConfig, browser, bookmaker);

        console.log(chalk.cyan(`[Test] Fetching provider detailed info for eventId=${providerEventId}`));
        const detailedProviderPayload = await edgeRunner.provider.getDetailedInfo(providerEventId);

        if (detailedProviderPayload?.data?.periods?.num_0) {
          const providerMarkets = {
            money_line: detailedProviderPayload.data.periods.num_0.money_line,
            spreads: detailedProviderPayload.data.periods.num_0.spreads,
            totals: detailedProviderPayload.data.periods.num_0.totals,
            sportId: 1, // Football
          };

          const valueBets = await edgeRunner.evaluateMarket(matchDetails.markets, providerMarkets);
          if (Array.isArray(valueBets) && valueBets.length) {
            const best = valueBets[0];
            market = best.market;
            selection = best.selection;
            console.log(chalk.green(`[Test] evaluateMarket selected: market="${market.name}" selection="${selection.name}" @ ${selection.odd.value} (value=${best.value.toFixed(2)}%)`));
          } else {
            console.log(chalk.yellow(`[Test] evaluateMarket found no value opportunities within thresholds; using initial pick.`));
          }
        } else {
          console.log(chalk.yellow(`[Test] Provider detailed info missing main period; skipping evaluateMarket.`));
        }
      } catch (evalErr) {
        console.log(chalk.red(`[Test] evaluateMarket error: ${evalErr.message}. Falling back to initial pick.`));
      }
    }

    const providerData = { sportId: 1 }; // Football

    // Build requested payloads
    let singlePayload = null;
    let multiPayload = null;

    if (includeSingle) {
      singlePayload = bookmaker.constructBetPayload(
        matchDetails,
        market,
        selection,
        stake,
        providerData,
      );
      console.log(chalk.yellow("[Test] Built SINGLE payload:"));
      console.log(JSON.stringify(singlePayload, null, 2));
    }

    if (includeMultiple) {
      multiPayload = await bookmaker.constructMultiSlipPayloadWithLowOdd(
        matchDetails,
        market,
        selection,
        stake,
        providerData,
        maxOdd,
      );
      console.log(chalk.yellow("[Test] Built MULTIPLE payload:"));
      console.log(JSON.stringify(multiPayload, null, 2));
    }

    if (!place) {
      console.log(chalk.green("[Test] Dry run complete. Use --place to submit the bet."));
      return;
    }

    // Place requested bets
    if (includeSingle && singlePayload) {
      const resSingle = await bookmaker.placeBet(username, singlePayload);
      console.log(chalk.green("[Test] SINGLE bet placement result:"));
      console.log(JSON.stringify(resSingle, null, 2));
    }

    if (includeMultiple && multiPayload) {
      if (multiPayload?.betCoupon?.couponTypeId !== 2) {
        console.log(chalk.yellow("[Test] Skipping MULTIPLE placement: built payload is not a multiple (FootballGO low-odd not available)."));
      } else {
        const resMulti = await bookmaker.placeBet(username, multiPayload);
        console.log(chalk.green("[Test] MULTIPLE bet placement result:"));
        console.log(JSON.stringify(resMulti, null, 2));
      }
    }
  } catch (err) {
    console.error(chalk.red(`[Test] Error: ${err.message}`));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();