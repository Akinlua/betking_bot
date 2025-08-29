import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

class Provider extends EventEmitter {
	constructor(config) {
		super();
		this.config = config;
		this.dumpFilePathName = 'provider_dump.json';
		this.dumpFilePath = path.join(process.cwd(), 'data/logs', this.dumpFilePathName);
		this.retryCount = 0;
		this.maxRetries = 5;
		this.state = {
			status: 'IDLE',
			message: 'Provider has not started polling.',
			cursor: null,
			lastChecked: null,
			alertsFound: 0,
		};
	}

	startPolling() {
		if (this.state.status === 'POLLING') {
			console.log('[Provider] Polling is already running.');
			return;
		}
		if (!this.config.userId) {
			const errorMessage = 'User Id not set. Polling cannot start.';
			this.state.status = 'ERROR';
			this.state.message = errorMessage;
			throw new Error(errorMessage);
		}

		this.state.status = 'POLLING';
		this.state.message = 'Actively polling for new alerts.';
		console.log(chalk.green(`[Provider] Polling Started [INTERVAL-${this.config.interval}]`));
		console.log(chalk.cyan(`[Provider] User ID: ${this.config.userId}`));
		this.poll();
	}

	async poll() {
		while (this.state.status === 'POLLING') {
			try {
				const url = new URL(this.config.alertApiUrl);
				if (this.state.cursor) {
					url.searchParams.set('dropNotificationsCursor', this.state.cursor);
				}

				const response = await fetch(url.toString(), { timeout: 60000 });

				if (!response.ok) {
					if (response.status === 401 || response.status === 403) {
						this.state.status = 'FATAL_ERROR';
						this.state.message = 'Invalid userId. Polling stopped.';
						this.emit('fatal', this.state.message);
						this.stopPolling();
						return;
					}
					throw new Error(`API responded with ${response.status}`);
				}

				const data = await response.json();
				const notifications = data.data;

				if (notifications && notifications.length > 0) {
					const lastAlert = notifications[notifications.length - 1];
					this.state.cursor = lastAlert.id;
					this.state.alertsFound += notifications.length;
					this.state.message = `Received ${notifications.length} new alerts.`;

					if (this.config.storeData) {
						try {
							const dir = path.dirname(this.dumpFilePath);
							await fs.mkdir(dir, { recursive: true });
							await fs.writeFile(this.dumpFilePath, JSON.stringify(notifications, null, 2));
						} catch (writeError) {
							console.error('[Provider] Error writing data to dump file:', writeError);
						}
					}

					this.emit('notifications', notifications);
				} else {
					this.state.message = 'No new notifications found.';
				}
				this.retryCount = 0;
			} catch (error) {
				this.state.status = 'ERROR';
				this.state.message = `Polling error: ${error.message}`;
				console.error('[Provider] Polling error:', error);

				if (this.retryCount >= this.maxRetries) {
					this.state.status = 'FATAL_ERROR';
					this.state.message = `Max retries (${this.maxRetries}) reached. Stopping polling.`;
					this.emit('fatal', this.state.message);
					this.stopPolling();
					return;
				}

				const delay = this.config.interval * Math.pow(2, this.retryCount);
				console.warn(chalk.yellow(`[Provider] Retrying in ${delay / 1000}s... (Attempt ${this.retryCount + 1}/${this.maxRetries})`));
				await new Promise(resolve => setTimeout(resolve, delay));
				this.retryCount++;
				continue; // Skip the regular interval and retry immediately
			} finally {
				this.state.lastChecked = new Date().toISOString();
				console.log(`[Provider] Status: ${this.state.status} | ${this.state.message}`);
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
			console.error("Error fetching detailed information", error);
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
						let low = 0.0001;
						let high = 10.0;
						const tolerance = 1e-10;
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

	getStatus() {
		return this.state;
	}

	stopPolling() {
		this.state.status = 'STOPPED';
		this.state.message = 'Polling has been stopped by user.';
		console.log(chalk.yellow('[Provider] Polling stopped.'));
	}
}

export default Provider;
