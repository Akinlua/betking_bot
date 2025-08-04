import { getBrowserInstance } from '../../core/browser.js';
import fs from "fs/promises";
import path from 'path';

export async function loadCookies(username) {
	const cookiePath = path.resolve(`data/cookies/${username}-cookies.json`);
	try {
		const cookieData = await fs.readFile(cookiePath, 'utf8');
		return JSON.parse(cookieData);
	} catch (error) {
		return [];
	}
}

export async function saveCookies(username, cookies) {
	const cookiePath = path.resolve(`./data/cookies/${username}-cookies.json`);
	await fs.mkdir(path.dirname(cookiePath), { recursive: true });
	await fs.writeFile(cookiePath, JSON.stringify(cookies, null, 2));
}

export async function areCookiesValid(cookies) {
	const accessToken = cookies.find(c => c.name === 'accessToken');
	if (!accessToken) {
		console.log('[Bookmaker] No accessToken cookie found');
		return false;
	}
	const now = Math.floor(Date.now() / 1000); // Current time in seconds
	if (accessToken.expires && accessToken.expires < now) {
		console.log('[Bookmaker] accessToken cookie expired');
		return false;
	}
	console.log('[Bookmaker] accessToken cookie is valid until', new Date(accessToken.expires * 1000));
	return true;
}

export async function _fetchJsonFromApi(url) {
	const browser = getBrowserInstance();
	let page;
	try {
		page = await browser.newPage();
		await page.setExtraHTTPHeaders({
			'Cache-Control': 'no-cache',
			'Pragma': 'no-cache'
		});
		// 30s
		const response = await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
		if (!response.ok()) {
			throw new Error(`Request failed with status: ${response.status()}`);
		}
		let res = await response.json();
		return res;
	} catch (error) {
		console.error(`[Bookmaker] Error fetching API URL ${url}:`, error.message);
		return null;
	} finally {
		if (page) await page.close();
	}
}

export function _slugifyEventName(name) {
	if (!name) return '';
	return name.toLowerCase()
		.replace(/ & /g, ' and ')
		.replace(/[^a-z0-9\s-]/g, '')
		.replace(/\s+/g, '-')
		.replace(/-+/g, '-');
}

