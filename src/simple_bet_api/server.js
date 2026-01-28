import express from 'express';
import morgan from 'morgan';
import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import chalk from 'chalk';
import "dotenv/config.js";
import routes from './routes.js';
import { Store } from '../bots/edgerunner/store.js';

puppeteer.use(stealthPlugin());

const app = express();
const PORT = process.env.SIMPLE_API_PORT || 3001;

app.use(morgan('dev'));
app.use(express.json());

// Singleton browser instance
let browser;

async function initBrowser() {
    // Read proxy configuration from accounts.json
    let proxyConf = null;
    try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const { fileURLToPath } = await import('url');
        const __dirname = path.dirname(fileURLToPath(import.meta.url));
        const accountsPath = path.join(__dirname, 'accounts.json');

        const accountsData = await fs.readFile(accountsPath, 'utf-8');
        const accounts = JSON.parse(accountsData);

        // Find first enabled proxy
        if (Array.isArray(accounts)) {
            const accountWithProxy = accounts.find(acc => acc.proxy?.enabled === true);
            if (accountWithProxy?.proxy) {
                proxyConf = accountWithProxy.proxy;
                console.log(chalk.blue(`[SimpleAPI] Found proxy configuration: ${proxyConf.ip}`));
            }
        }
    } catch (error) {
        console.log(chalk.yellow(`[SimpleAPI] Could not read proxy from accounts.json: ${error.message}`));
    }

    // Get local IP for proxy validation
    let localIp = null;
    try {
        localIp = await (await fetch("https://api.ipify.org")).text();
        console.log(chalk.gray(`[SimpleAPI] Local IP: ${localIp}`));
    } catch (error) {
        console.log(chalk.yellow(`[SimpleAPI] Could not fetch local IP: ${error.message}`));
    }

    const launchOptions = {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--no-zygote",
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

    // Add proxy to launch options if configured
    if (proxyConf && proxyConf.enabled && proxyConf.ip) {
        console.log(chalk.blue(`[SimpleAPI] Attempting to use proxy: ${proxyConf.ip}`));
        launchOptions.args.push(`--proxy-server=${proxyConf.ip}`);
    }

    browser = await puppeteer.launch(launchOptions);

    // Validate proxy connection if enabled
    if (proxyConf && proxyConf.enabled) {
        console.log(chalk.yellow("[SimpleAPI] Validating proxy connection..."));
        let testPage;
        try {
            testPage = await browser.newPage();

            // Authenticate with proxy if credentials provided
            if (proxyConf.username && proxyConf.password) {
                await testPage.authenticate({
                    username: proxyConf.username,
                    password: proxyConf.password,
                });
                console.log(chalk.dim("[SimpleAPI] Proxy authentication configured."));
            }

            // Check IP to validate proxy
            await testPage.goto("https://api.ipify.org", {
                timeout: 60_000,
                waitUntil: "domcontentloaded",
            });

            const detectedIp = await testPage.evaluate(() => document.body.innerText.trim());
            const normalize = (ip) => ip.trim().replace(/^::ffff:/, "");

            if (detectedIp && normalize(detectedIp) !== normalize(localIp || "")) {
                console.log(chalk.green.bold(`[SimpleAPI] ✓ Proxy connection successful! Exit IP: ${normalize(detectedIp)}`));
            } else {
                console.log(chalk.red.bold("[SimpleAPI] ✗ Proxy validation failed — IP not changed."));
                console.log(chalk.red(`  Local IP: ${localIp}`));
                console.log(chalk.red(`  Detected via proxy: ${detectedIp}`));
                await testPage.close();
                await browser.close();
                throw new Error("Proxy did not mask IP correctly.");
            }

            await testPage.close();
        } catch (error) {
            console.error(chalk.red.bold("[SimpleAPI] Proxy connection FAILED."));
            console.error(chalk.red(`Error: ${error.message}`));
            if (testPage) {
                await testPage.close();
            }
            if (browser) {
                await browser.close();
            }
            throw new Error(`Proxy validation failed: ${error.message}`);
        }
    }

    console.log(chalk.green("[SimpleAPI] Browser initialized."));
    return browser;
}

// Middleware to inject browser into request
app.use((req, res, next) => {
    req.browser = browser;
    // req.store removed - store is per-user now
    next();
});

app.use('/', routes);

async function startServer() {
    try {
        await initBrowser();

        // Import and initialize Auth Service
        const { initAuthService } = await import('./auth.service.js');
        initAuthService(browser);

        app.listen(PORT, () => {
            console.log(chalk.green(`[SimpleAPI] Server running on http://localhost:${PORT}`));
        });
    } catch (error) {
        console.error(chalk.red("[SimpleAPI] Failed to start server:"), error);
        process.exit(1);
    }
}

// Graceful shutdown
process.on('SIGINT', async () => {
    console.log(chalk.yellow("\n[SimpleAPI] Shutting down..."));
    if (browser) await browser.close();
    process.exit(0);
});

startServer();


// "proxy": {
//             "enabled": true,
//             "ip": "isp.decodo.com:10010",
//             "username": "spqib3jo21",
//             "password": "S_bb7zjHX9deQ1juw3"
//         }

// {
//         "username": "Tehmple",
//         "password": "Skeepoh10$",
//         "stake": 2000
//     },