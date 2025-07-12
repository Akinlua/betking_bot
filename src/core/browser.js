import puppeteer from 'puppeteer-extra';
import stealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(stealthPlugin());

let browser = null;

/**
 * Initializes and launches the shared browser instance with lightweight arguments.
 */
export async function initializeBrowser() {
    if (browser) return;
    console.log('[Browser] Initializing new optimized browser instance...');
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        });
        console.log('[Browser] Browser initialized successfully.');
    } catch (error) {
        console.error('[Browser] Failed to launch browser:', error);
        throw error;
    }
}

/**
 * Closes the shared browser instance.
 */
export async function closeBrowser() {
    if (browser) {
        console.log('[Browser] Closing browser instance...');
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
