import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';
import chalk from 'chalk';

puppeteer.use(stealthPlugin());

let browser = null;

/**
 * Initializes and launches the shared browser instance with lightweight arguments.
 */
export async function initializeBrowser() {
	if (browser) return;
	try {
		browser = await puppeteer.launch({
			headless: true,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
                '--no-zygote', 
                '--single-process', 
				'--disable-extensions',
				'--disable-sync',
				'--disable-translate',
				'--mute-audio',
				'--no-first-run',
				'--disable-gpu',
				'--disable-dev-shm-usage',
				'--disable-http-cache',
                '--disable-background-networking', 
                '--disable-features=site-per-process', 
				'--disable-accelerated-2d-canvas',
				'--disable-background-timer-throttling',
				'--disable-client-side-phishing-detection'
			],
			protocolTimeout: 60_000, // 60s timeout for CDP commands
		});
		console.log(chalk.green('[Browser] -> Browser Initialized'));
	} catch (error) {
		console.error(chalk.red('[Browser] -> Initialization Failed: ', error));
		throw error;
	}
}

/**
 * Closes the shared browser instance.
 */
export async function closeBrowser() {
	if (browser) {
		console.log('[Browser] Closing browser instance');
		await browser.close();
		browser = null;
	}
}

/**
 * Returns the shared browser instance. Throws an error if not initialized.
 * @returns {import('puppeteer').Browser}
 */
export function getBrowserInstance() {
	if (!browser) {
		throw new Error('Browser is not initialized. Please call initializeBrowser() first.');
	}
	return browser;
}
