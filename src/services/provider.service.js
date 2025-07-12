import fs from 'fs/promises'; // Import the file system module
import path from 'path';
import configurations from "../../configurations/index.js";
import { addGamesToProcessingQueue } from './bot.service.js';

const POLLING_INTERVAL_MS = 500;
const ALERT_API_URL = `https://swordfish-production.up.railway.app/alerts/${configurations.USER_ID}`;
const DUMP_FILE_PATH = path.join(process.cwd(), 'data', 'provider_dump.json');

const botState = {
    isRunning: false,
    statusMessage: "Idle",
    cursor: null,
    lastChecked: null,
    alertsFound: 0
};

export function startPolling() {
    if (botState.isRunning) {
        console.log("[Provider Service] Polling is already running.");
        return;
    }
    if (!configurations.USER_ID) {
        console.error("[Provider Service] FATAL: configurations.USER_ID is not set. Polling cannot start.");
        return;
    }
    botState.isRunning = true;
    console.log("[Provider Service] --- Starting Polling ---");
    console.log(`[Provider Service] Polling URL: ${ALERT_API_URL}`);
    poll();
}

async function poll() {
    while (botState.isRunning) {
        let timestamp;
        try {
            const url = new URL(ALERT_API_URL);
            if (botState.cursor) {
                url.searchParams.set("dropNotificationsCursor", botState.cursor);
            }

            const response = await fetch(url.toString(), { timeout: 60000 });
            if (!response.ok) {
                throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const notifications = data.data;

            if (notifications && notifications.length > 0) {
                const lastAlert = notifications[notifications.length - 1];
                botState.cursor = lastAlert.id;
                botState.alertsFound += notifications.length;
                botState.statusMessage = `SUCCESS: Received ${notifications.length} new alerts.`;

                // --- NEW: Save the received data to a file for inspection ---
                try {
                    // JSON.stringify with formatting for readability
                    await fs.writeFile(DUMP_FILE_PATH, JSON.stringify(notifications, null, 2));
                    console.log(`[Provider Service] Successfully dumped ${notifications.length} alerts to ${DUMP_FILE_PATH}`);
                } catch (writeError) {
                    console.error('[Provider Service] Error writing data to dump file:', writeError);
                }
                // --- END OF NEW CODE ---

                // Send the found notifications to the bot for processing
                addGamesToProcessingQueue(notifications);

            } else {
                botState.statusMessage = "STATUS: No new notifications.";
            }

        } catch (error) {
            botState.statusMessage = `ERROR: ${error.message}`;
            console.error("[Provider Service] Polling error:", error);
        } finally {
            botState.lastChecked = new Date().toISOString();
            timestamp = new Date().toLocaleTimeString();
            console.log(`[${timestamp}] [Provider] ${botState.statusMessage} | Cursor: ${botState.cursor}`);
        }

        await new Promise(resolve => setTimeout(resolve, POLLING_INTERVAL_MS));
    }
}

export function getPollingStatus() {
    return botState;
}
