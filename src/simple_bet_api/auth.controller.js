import BetKingBookmaker from "../interfaces/bookmakers/betking/index.js";
import { Store } from "../bots/edgerunner/store.js";
import chalk from "chalk";

export async function login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ error: "Username and password are required." });
    }

    /* 
       Architecture Note:
       We are using the browser instance attached to the request (singleton).
       This means sequential logins share the browser. BetKingBookmaker 
       likely handles cookie clearing or isolation if needed, OR we rely on 
       Puppeteer's default behavior where we might conflict if parallel.
       For this "simple" API, assumes sequential or low concurrency.
    */
    const { browser } = req;

    try {
        console.log(chalk.cyan(`[Auth] Logging in user: ${username}`));

        // 1. Initialize Store for this user
        // This creates/loads data/edgerunner/<username>.json
        const store = new Store(username);
        await store.initialize();

        // 2. Save credentials for background re-login
        // Since 'credentials' is not in defaultEdgerunnerState, we add it directly
        const storeData = store.getData();
        if (!storeData.credentials) {
            storeData.credentials = {};
        }
        storeData.credentials.username = username;
        storeData.credentials.password = password;
        // Write to disk
        await store.updateAndWrite("credentials", { username, password });

        // 3. Initialize Bookmaker
        const bookmakerConf = {
            name: "BetKing",
            username: username,
            password: password,
        };
        const bookmaker = new BetKingBookmaker(bookmakerConf, browser, store);

        // 4. Perform Sign-in
        const loginRes = await bookmaker.signin(username, password);

        if (loginRes.success) {
            console.log(chalk.green(`[Auth] Login successful for ${username}`));
            return res.json({ status: "success", message: "User logged in and session saved." });
        } else {
            console.log(chalk.red(`[Auth] Login failed for ${username}: ${loginRes.error}`));
            return res.status(401).json({ status: "failed", error: loginRes.error });
        }

    } catch (error) {
        console.error(chalk.red(`[Auth] Error logging in ${username}:`), error);
        return res.status(500).json({ error: error.message });
    }
}
