import { chromium } from "playwright";

(async () => {
    const browser = await chromium.launch({
        headless: false, // set true later
    });

    const context = await browser.newContext({
        locale: "en-US",
        userAgent:
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36",
    });

    const page = await context.newPage();

    // 1️⃣ Open BetKing (this generates cookies, tokens, cf_clearance, etc.)
    await page.goto("https://m.betking.com/en-ng/sports", {
        waitUntil: "networkidle",
    });

    // OPTIONAL: ensure logged in if required
    // await page.goto("https://m.betking.com/en-ng/login");

    // 2️⃣ Execute the placebet request INSIDE the browser
    const result = await page.evaluate(async () => {
        const formData = new FormData();

        formData.append(
            "data",
            JSON.stringify({
                betCoupon: {
                    isClientSideCoupon: true,
                    couponTypeId: 1,
                    minWin: 120,
                    minWinNet: 120,
                    netStakeMinWin: 120,
                    maxWin: 120,
                    maxWinNet: 120,
                    netStakeMaxWin: 120,
                    minBonus: 0,
                    maxBonus: 0,
                    minPercentageBonus: 0,
                    maxPercentageBonus: 0,
                    minOdd: 12,
                    maxOdd: 12,
                    totalOdds: 12,
                    stake: 10,
                    useGroupsStake: false,
                    stakeGross: 10,
                    stakeTaxed: 0,
                    taxPercentage: 0,
                    tax: 0,
                    totalCombinations: 1,
                    currencyId: 16,
                    isLive: true,
                    allowOddChanges: false,
                    odds: [
                        {
                            IDSport: 1,
                            eventId: 11521998,
                            matchId: 33718056,
                            marketId: 551928127,
                            selectionId: 1787373377,
                            oddValue: 12,
                            marketName: "1X2",
                            selectionName: "2",
                            sportName: "Football",
                            tournamentName: "India Bengal Super League",
                        },
                    ],
                },
                requestTransactionId: String(Date.now()),
            })
        );

        formData.append(
            "adjustIds",
            JSON.stringify({
                adjustId: "",
                adjustIdfa: "",
                gpsAdId: "",
            })
        );

        const res = await fetch(
            "https://m.betking.com/en-ng/sports/action/placebet?_data=routes%2F%28%24locale%29.sports.action.placebet",
            {
                method: "PUT",
                credentials: "include", // VERY IMPORTANT
                body: formData,
            }
        );

        return await res.text();
    });

    console.log("Placebet response:", result);

    await browser.close();
})();
