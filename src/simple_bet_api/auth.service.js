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
const ACCOUNTS_FILE = path.join(__dirname, "accounts.json");
let _browser = null;

export function initAuthService(browser) {
    _browser = browser;
    console.log(chalk.green("[AuthService] Initialized. Starting initial sync and login sequence..."));

    // Immediate sync and login on startup
    syncAndLoginAll().then(() => {
        console.log(chalk.green("[AuthService] Initial sync and login sequence completed. Scheduling re-login task (Every 6 Hours)."));

        nodeCron.schedule("0 */6 * * *", async () => {
            console.log(chalk.cyan(`\n[AuthService] Starting scheduled re-login for all accounts...`));
            await reLoginAll();
        });
    });
}

function getStore(username) {
    return new Store(username);
}

/**
 * Reads accounts.json, ensures they are in the store, and then triggers a mass login.
 */
async function syncAndLoginAll() {
    console.log(chalk.cyan("[AuthService] Syncing accounts from accounts.json..."));
    try {
        const accountsData = await fs.readFile(ACCOUNTS_FILE, 'utf-8');
        const accounts = JSON.parse(accountsData);

        if (!Array.isArray(accounts)) {
            console.error(chalk.red("[AuthService] accounts.json is not an array."));
            return;
        }

        // Flush stale accounts: Remove data files for users not in accounts.json
        try {
            const validUsernames = new Set(accounts.map(a => a.username).filter(Boolean));

            // Check if data dir exists before reading
            try {
                await fs.access(DATA_DIR);
                const files = await fs.readdir(DATA_DIR);

                for (const file of files) {
                    if (file.endsWith(".json")) {
                        const username = path.basename(file, ".json");
                        if (!validUsernames.has(username)) {
                            console.log(chalk.yellow(`[AuthService] Flushing stale account data for: ${username}`));
                            await fs.unlink(path.join(DATA_DIR, file));
                        }
                    }
                }
            } catch (err) {
                // Ignore if data dir doesn't exist yet
                if (err.code !== 'ENOENT') throw err;
            }
        } catch (err) {
            console.error(chalk.yellow(`[AuthService] Warning during stale account cleanup: ${err.message}`));
        }

        console.log(chalk.dim(`[AuthService] Found ${accounts.length} accounts in configuration.`));

        for (const account of accounts) {
            const { username, password } = account;
            if (!username || !password) continue;

            try {
                const store = getStore(username);
                await store.initialize();

                // Save/Update credentials
                await store.setCredentials({ username, password });

                console.log(chalk.dim(`[AuthService] Synced credentials for ${username}`));
            } catch (err) {
                console.error(chalk.red(`[AuthService] Failed to sync ${username}:`), err);
            }
        }

    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log(chalk.yellow("[AuthService] accounts.json not found. Skipping sync."));
        } else {
            console.error(chalk.red("[AuthService] Error reading accounts.json:"), error);
        }
    }

    // Now perform the login for everyone (newly synced + existing)
    await reLoginAll();
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

        console.log(chalk.dim(`[AuthService] Found ${userFiles.length} accounts in storage.`));

        for (const file of userFiles) {
            const username = path.basename(file, ".json");
            console.log(chalk.cyan(`[AuthService] Refreshing session for: ${username}`));

            try {
                const store = getStore(username);
                await store.initialize();

                const data = store.getData();
                const creds = data.credentials || {};

                if (!creds.password) {
                    console.log(chalk.yellow(`[AuthService] No password saved for ${username}, skipping.`));
                    continue;
                }

                const bookmakerConf = {
                    name: "BetKing",
                    username: username,
                    password: creds.password,
                    isLive: true
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
