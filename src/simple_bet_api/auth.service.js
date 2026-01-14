import nodeCron from "node-cron";
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { Store } from "../bots/edgerunner/store.js";
import BetKingBookmaker from "../interfaces/bookmakers/betking/index.js";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Assuming data dir is relative to project root, which Store defaults to.
// But we need to scan it. Store default: process.cwd()/data
const DATA_DIR = path.join(process.cwd(), "data", "edgerunner");

// Singleton browser accessor (passed from server start)
let _browser = null;

export function initAuthService(browser) {
    _browser = browser;
    console.log(chalk.green("[AuthService] Initialized. Scheduling re-login task (Every 6 Hours)."));

    nodeCron.schedule("0 */6 * * *", async () => {
        console.log(chalk.cyan(`\n[AuthService] Starting scheduled re-login for all accounts...`));
        await reLoginAll();
    });
}

function getStore(username) {
    return new Store(username);
}

async function reLoginAll() {
    if (!_browser) {
        console.error(chalk.red("[AuthService] Browser not initialized, skipping re-login."));
        return;
    }

    try {
        // 1. List all files in data/edgerunner
        // Ensure dir exists
        try {
            await fs.access(DATA_DIR);
        } catch {
            console.log(chalk.yellow("[AuthService] Data directory not found, no accounts to refresh."));
            return;
        }

        const files = await fs.readdir(DATA_DIR);
        const userFiles = files.filter(f => f.endsWith(".json"));

        console.log(chalk.dim(`[AuthService] Found ${userFiles.length} accounts.`));

        for (const file of userFiles) {
            const username = path.basename(file, ".json");
            console.log(chalk.cyan(`[AuthService] Refreshing session for: ${username}`));

            try {
                const store = getStore(username);
                await store.initialize();

                const data = store.getData();
                const creds = data.credentials || {}; // We saved this in login controller

                if (!creds.password) {
                    console.log(chalk.yellow(`[AuthService] No password saved for ${username}, skipping.`));
                    continue;
                }

                const bookmakerConf = {
                    name: "BetKing",
                    username: username,
                    password: creds.password,
                };

                const bookmaker = new BetKingBookmaker(bookmakerConf, _browser, store);

                // Perform signin (forces refresh/login and saves cookies)
                const res = await bookmaker.signin(username, creds.password);

                if (res.success) {
                    console.log(chalk.green(`[AuthService] Successfully refreshed ${username}`));
                } else {
                    console.log(chalk.red(`[AuthService] Failed to refresh ${username}: ${res.error}`));
                }

            } catch (err) {
                console.error(chalk.red(`[AuthService] Error processing ${username}:`), err);
            }
        }
        console.log(chalk.cyan("[AuthService] Re-login cycle complete."));

    } catch (error) {
        console.error(chalk.red("[AuthService] Critical error in re-login loop:"), error);
    }
}
