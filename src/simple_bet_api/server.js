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
    const launchOptions = {
        headless: true, // or false for debugging
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
    browser = await puppeteer.launch(launchOptions);
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
