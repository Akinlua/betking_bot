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

  devigOdds(providerData) {
    const { lineType, priceHome, priceAway, priceDraw, priceOver, priceUnder } = providerData;

    const parseOdd = (odd, fieldName) => {
      const parsed = parseFloat(odd);
      if (isNaN(parsed) || parsed <= 1) {
        throw new Error(`Invalid odd for ${fieldName}: ${odd}`);
      }
      return parsed;
    };

    try {
      let odds = [];
      let outcomeKeys = [];

      if (lineType === 'money_line') {
        if (!priceHome || !priceAway || !priceDraw) {
          throw new Error('Missing prices for money_line');
        }
        odds = [
          parseOdd(priceHome, 'priceHome'),
          parseOdd(priceAway, 'priceAway'),
          parseOdd(priceDraw, 'priceDraw'),
        ];
        outcomeKeys = ['home', 'away', 'draw'];
      } else if (lineType === 'total') {
        if (!priceOver || !priceUnder) {
          throw new Error('Missing prices for total');
        }
        odds = [
          parseOdd(priceOver, 'priceOver'),
          parseOdd(priceUnder, 'priceUnder'),
        ];
        outcomeKeys = ['over', 'under'];
      } else if (lineType === 'spread') {
        if (!priceHome || !priceAway) {
          throw new Error('Missing prices for spread');
        }
        odds = [
          parseOdd(priceHome, 'priceHome'),
          parseOdd(priceAway, 'priceAway'),
        ];
        outcomeKeys = ['home', 'away'];
      } else {
        throw new Error(`Unsupported line type: ${lineType}`);
      }

      const impliedProbs = odds.map(odd => 1 / odd);
      const totalProb = impliedProbs.reduce((sum, p) => sum + p, 0);

      if (totalProb <= 0) {
        throw new Error('Total probability is not positive');
      }

      const trueOdds = {};
      outcomeKeys.forEach((key, i) => {
        trueOdds[key] = Number((1 / (impliedProbs[i] / totalProb)).toFixed(2));
      });

      return trueOdds;
    } catch (error) {
      console.error('[Provider] Error during devigging calculation:', error.message);
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
