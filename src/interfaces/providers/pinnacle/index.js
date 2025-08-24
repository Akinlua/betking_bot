import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

class Provider extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.dumpFilePathName = 'provider_dump.json';
		this.dumpFilePath = path.join(process.cwd(), 'data', this.dumpFilePathName);
		this.state = {
			isRunning: false,
			statusMessage: 'Idle',
			cursor: null,
			lastChecked: null,
			alertsFound: 0,
		};
	}

	startPolling() {
		if (this.state.isRunning) {
			console.log('[Provider] Polling is already running.');
			return;
		}
		if (!this.config.userId) {
			console.error('[Provider] User Id not set. Polling cannot start.');
			return;
		}
		this.state.isRunning = true;
		console.log(chalk.green(`[Provider] Polling Started [INTERVAL-${this.config.interval}]`));
		console.log(chalk.cyan(`[Provider] User ID: ${this.config.userId}`));
		this.poll();
	}

	async poll() {
		while (this.state.isRunning) {
			try {
				const url = new URL(this.config.alertApiUrl);
				if (this.state.cursor) {
					url.searchParams.set('dropNotificationsCursor', this.state.cursor);
				}

				const response = await fetch(url.toString(), { timeout: 60000 });
				if (!response.ok) {
					throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();
				const notifications = data.data;

				if (notifications && notifications.length > 0) {
					const lastAlert = notifications[notifications.length - 1];
					this.state.cursor = lastAlert.id;
					this.state.alertsFound += notifications.length;
					this.state.statusMessage = `SUCCESS: Received ${notifications.length} new alerts.`;

					if (this.config.storeData) {
						try {
							const dir = path.dirname(this.dumpFilePath);
							await fs.mkdir(dir, { recursive: true });
							await fs.writeFile(this.dumpFilePath, JSON.stringify(notifications, null, 2));
							console.log(`[Provider] Successfully dumped ${notifications.length} to DUMP FILE PATH`);
						} catch (writeError) {
							console.error('[Provider] Error writing data to dump file:', writeError);
						}
					}

					// Emit notifications event instead of calling addGamesToProcessingQueue
					this.emit('notifications', notifications);
				} else {
					this.state.statusMessage = 'STATUS: No new notifications.';
				}
			} catch (error) {
				this.state.statusMessage = `ERROR: ${error.message}`;
				console.error('[Provider] Polling error:', error);
			} finally {
				this.state.lastChecked = new Date().toISOString();
				console.log(`[Provider] ${this.state.statusMessage} | Cursor: ${this.state.cursor}`);
			}

			await new Promise(resolve => setTimeout(resolve, this.config.interval * 1000));
		}
	}

	async getDetailedInfo(eventId) {
		if (!eventId) {
			throw new Error("must recieve eventId");
		}

		const numericEventId = parseInt(eventId, 10);
		if (Number.isNaN(numericEventId)) {
			throw new Error("eventId must be a number");
		}
		const detailedUrl = `https://swordfish-production.up.railway.app/events/${eventId}`;

		try {
			const result = await fetch(detailedUrl);
			if (!result.ok) {
				throw new Error(`API request failed with status ${result.status}`);
			}

			const data = await result.json();
			return data;
		} catch (error) {
			console.error("Error fetchinf detailed information", error);
			return null;
		}
	}

	devigOdds(odds, method = 'power') {
		try {
			if (!Array.isArray(odds) || odds.length < 2) {
				throw new Error('Input must be an array of at least two odds.');
			}
			const parsedOdds = odds.map(o => parseFloat(o));
			if (parsedOdds.some(o => isNaN(o) || o <= 1)) {
				throw new Error('All items in odds array must be numbers greater than 1.');
			}

			const impliedProbs = parsedOdds.map(o => 1 / o);
			const totalImpliedProb = impliedProbs.reduce((sum, p) => sum + p, 0);

			if (totalImpliedProb <= 1) {
				return parsedOdds;
			}

			let trueProbs;

			switch (method.toLowerCase()) {

				case 'multiplicative':
					trueProbs = impliedProbs.map(p => p / totalImpliedProb);
					break;

				case 'additive':
					const overround = totalImpliedProb - 1;
					const adjustment = overround / parsedOdds.length;
					trueProbs = impliedProbs.map(p => p - adjustment);
					if (trueProbs.some(p => p <= 0)) {
						console.warn('[devigOdds] Additive method resulted in a non-positive probability. Falling back to multiplicative.');
						trueProbs = impliedProbs.map(p => p / totalImpliedProb);
					}
					break;

				case 'power':
				default: 
					const findK = () => {
						let low = 1.0;
						let high = 4.0; 
						const tolerance = 1e-7;
						for (let i = 0; i < 100; i++) {
							let k = (low + high) / 2;
							let sum = impliedProbs.reduce((acc, p) => acc + Math.pow(p, k), 0);
							if (Math.abs(sum - 1.0) < tolerance) return k;
							if (sum > 1) {
								low = k;
							} else {
								high = k;
							}
						}
						return (low + high) / 2; 
					};
					const k = findK();
					const powerProbs = impliedProbs.map(p => Math.pow(p, k));
					const totalPowerProb = powerProbs.reduce((sum, p) => sum + p, 0);
					trueProbs = powerProbs.map(p => p / totalPowerProb);
					break;
			}

			const noVigOdds = trueProbs.map(p => 1 / p);

			return noVigOdds;

		} catch (error) {
			console.error('[devigOdds] Error during calculation:', error.message);
			return null;
		}
	}



	getPollingStatus() {
		return this.state;
	}

	stopPolling() {
		this.state.isRunning = false;
		this.state.statusMessage = 'Stopped';
		console.log(chalk.yellow('[Provider] Polling stopped.'));
	}
}

export default Provider;
