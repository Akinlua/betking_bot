# EdgeRunner Bot System

The EdgeRunner Bot System is a Node.js application for running automated betting bots that poll alerts from a provider (e.g., Pinnacle) and place bets on a bookmaker (e.g., BetKing). The system uses `child_process` to manage multiple bot instances, each with its own configuration stored in `data/edgerunner/`. This README focuses on the `EdgeRunner` class, its configuration, and how to run bots directly or via the API.

## Table of Contents

* [Overview](#overview)
* [EdgeRunner Class](#edgerunner-class)
* [Configuration Object](#configuration-object)
* [Running a Bot Directly](#running-a-bot-directly)
* [Running Bots via API](#running-bots-via-api)
* [API Endpoints](#api-endpoints)
* [Directory Structure](#directory-structure)
* [Setup and Installation](#setup-and-installation)
* [Troubleshooting](#troubleshooting)

## Overview

The `EdgeRunner` class (`src/bots/edgerunner/index.js`) is the core of the bot system. It polls alerts from a provider’s API (e.g., `https://swordfish-production.up.railway.app/alerts/<userId>`) and places bets on a bookmaker based on the provided configuration. Bots can be run standalone by instantiating `EdgeRunner` or managed via HTTP endpoints (`/edgerunner/*`) using a Node.js server with `child_process` for process isolation.

## EdgeRunner Class

The `EdgeRunner` class handles:

* **Polling**: Fetches alerts from `provider.alertApiUrl` every `provider.interval` seconds.
* **Betting**: Places bets on `bookmaker.name` (e.g., BetKing) using `bookmaker.username` and `bookmaker.password`.
* **Stake Management**: Uses `edgerunner.fixedStake` or `edgerunner.stakeFraction` to determine bet amounts, with `edgerunner.minValueBetPercentage` filtering low-value bets.

### Methods

* `constructor(config)`: Initializes the bot with a configuration object.
* `async initialize()`: Sets up connections (e.g., authenticates with the bookmaker).
* `start()`: Begins polling and betting.
* `async stop()`: Stops polling and cleans up.
* `getStatus()`: Returns the bot’s status (e.g., `{ status: "running" }`).

## Configuration Object

The `EdgeRunner` class requires a JSON configuration object with three sections: `provider`, `bookmaker`, and `edgerunner`. Below is the structure and purpose of each field:

```json
{
  "provider": {
    "name": "pinnacle",
    "storeData": true,
    "interval": 2,
    "userId": "user_30I2I43w4GgKpp0wHILCzs6HJmU",
    "alertApiUrl": "https://swordfish-production.up.railway.app/alerts/user_30I2I43w4GgKpp0wHILCzs6HJmU"
  },
  "bookmaker": {
    "name": "betking",
    "storeData": true,
    "interval": 2,
    "username": "07033054766",
    "password": "A1N2S3I4"
  },
  "edgerunner": {
    "name": "edgerunner",
    "stakeFraction": 0.1,
    "fixedStake": {
      "enabled": true,
      "value": 10
    },
    "minValueBetPercentage": 0
  }
}
```

### Field Descriptions

* **provider**:

  * `name` (string): Provider name (e.g., `"pinnacle"`). Used for logging and configuration.
  * `storeData` (boolean): If `true`, stores alert data in `data/cookies/` for persistence.
  * `interval` (number): Polling interval in seconds (e.g., `2` for every 2 seconds).
  * `userId` (string): Unique user ID (e.g., `user_30I2I43w4GgKpp0wHILCzs6HJmU`). Must be unique across bots.
  * `alertApiUrl` (string): URL for fetching alerts (e.g., `https://swordfish-production.up.railway.app/alerts/<userId>`).
* **bookmaker**:

  * `name` (string): Bookmaker name (e.g., `"betking"`).
  * `storeData` (boolean): If `true`, stores bookmaker session data in `data/cookies/`.
  * `interval` (number): Interval for bookmaker actions (e.g., checking bet status) in seconds.
  * `username` (string): Bookmaker account username (e.g., `07033054766`). Must be unique.
  * `password` (string): Bookmaker account password.
* **edgerunner**:

  * `name` (string): Bot name (e.g., `"edgerunner"`). Used for identification.
  * `stakeFraction` (number): Fraction of account balance to bet if `fixedStake.enabled` is `false` (e.g., `0.1` for 10%).
  * `fixedStake` (object):

    * `enabled` (boolean): If `true`, uses a fixed bet amount; if `false`, uses `stakeFraction`.
    * `value` (number): Fixed bet amount (e.g., `10` for $10).
  * `minValueBetPercentage` (number): Minimum expected value percentage for placing bets (e.g., `0` to accept all bets).

## Running a Bot Directly

To run a bot standalone (without the API), instantiate `EdgeRunner` in a script:

1. Create `run-bot.js`:

   ```javascript
   import EdgeRunner from './src/bots/edgerunner/index.js';

   const config = {
     provider: {
       name: "pinnacle",
       storeData: true,
       interval: 2,
       userId: "user_30I2I43w4GgKpp0wHILCzs6HJmU",
       alertApiUrl: "https://swordfish-production.up.railway.app/alerts/user_30I2I43w4GgKpp0wHILCzs6HJmU"
     },
     bookmaker: {
       name: "betking",
       storeData: true,
       interval: 2,
       username: "07033054766",
       password: "A1N2S3I4"
     },
     edgerunner: {
       name: "edgerunner",
       stakeFraction: 0.1,
       fixedStake: { enabled: true, value: 10 },
       minValueBetPercentage: 0
     }
   };

   async function main() {
     const bot = new EdgeRunner(config);
     await bot.initialize();
     bot.start();
   }

   main().catch(console.error);
   ```

2. Ensure directories exist:

   ```bash
   mkdir -p data/edgerunner data/cookies
   chmod -R u+w data
   ```

3. Run:

   ```bash
   node run-bot.js
   ```

   **Expected Output**:

   ```
   [BotRunner] EdgeRunner started with config: (inline)
   [Provider] STATUS: No new notifications | Cursor: <cursor>
   ```

   **Note**: This runs a single bot without process management. Use the API for multiple bots.

## Running Bots via API

The API (`src/server.js`) uses `child_process` to manage multiple `EdgeRunner` instances, each with its own config stored in `data/edgerunner/<botId>.json`. The server runs on `http://localhost:9090` (configurable via `.env`).

### API Endpoints

1. **Start a Bot** (`POST /edgerunner/start`):

   * **Body**: Config object (see [Configuration Object](#configuration-object)).
   * **Response**: `{ "message": "Bot started", "pm_id": "<botId>", "name": "edgerunner-<botId>" }`
   * **Example**:

     ```bash
     curl -X POST http://localhost:9090/edgerunner/start -H "Content-Type: application/json" -d @config.json
     ```

     Output: `{"message":"Bot started","pm_id":"me67eauzpix13fg32rg","name":"edgerunner-me67eauzpix13fg32rg"}`

2. **List Bots** (`GET /edgerunner/list`):

   * **Response**: `{ "bots": [{ "pm_id": "<botId>", "name": "edgerunner-<botId>", "status": "online" }, ...] }`
   * **Example**:

     ```bash
     curl http://localhost:9090/edgerunner/list
     ```

     Output: `{"bots":[{"pm_id":"me67eauzpix13fg32rg","name":"edgerunner-me67eauzpix13fg32rg","status":"online"}]}`

3. **Get Bot Status** (`GET /edgerunner/status/:id`):

   * **Response**: `{ "message": "Bot status", "pm_id": "<botId>", "status": "<status>" }`
   * **Example**:

     ```bash
     curl http://localhost:9090/edgerunner/status/me67eauzpix13fg32rg
     ```

     Output: `{"message":"Bot status","pm_id":"me67eauzpix13fg32rg","status":"online"}`

4. **Stop a Bot** (`POST /edgerunner/stop/:id`):

   * **Response**: `{ "message": "Bot stopped", "pm_id": "<botId>" }`
   * **Example**:

     ```bash
     curl -X POST http://localhost:9090/edgerunner/stop/me67eauzpix13fg32rg
     ```

     Output: `{"message":"Bot stopped","pm_id":"me67eauzpix13fg32rg"}`

5. **Update Bot Config** (`POST /edgerunner/config/:id`):

   * **Body**: `{ "fixedStake": { "enabled": true, "value": 15 }, "stakeFraction": 0.2, "minValueBetPercentage": 1 }`
   * **Response**: `{ "message": "Bot configuration updated", "pm_id": "<botId>" }`
   * **Example**:

     ```bash
     curl -X POST http://localhost:9090/edgerunner/config/me67eauzpix13fg32rg -H "Content-Type: application/json" -d '{"fixedStake":{"enabled":true,"value":15},"stakeFraction":0.2,"min
     ```


ValueBetPercentage":1}'
```
Output: `{"message":"Bot configuration updated","pm_id":"me67eauzpix13fg32rg"}`

## Directory Structure

* `data/edgerunner/` — Stores JSON config files per bot (e.g., `me67eauzpix13fg32rg.json`).
* `data/cookies/` — Stores cookies/session data per bot and bookmaker.
* `src/bots/edgerunner/` — EdgeRunner bot implementation.
* `src/server.js` — Express API server managing bot child processes.

## Setup and Installation

1. Clone repository:

   ```bash
   git clone <repo-url>
   cd edgerunner-bot
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create necessary directories:

   ```bash
   mkdir -p data/edgerunner data/cookies
   chmod -R u+w data
   ```

4. Create `.env` file if you want to change the default port (default `9090`):

   ```
   PORT=9090
   ```

5. Start the server:

   ```bash
   node src/server.js
   ```

## Troubleshooting

* If you get permission errors writing to `data/`, check directory ownership and permissions.
* Ensure `provider.userId` and `bookmaker.username` are unique per bot.
* Check logs printed by each child process in the terminal or use the API to query bot statuses.

---

## Starting the EdgeRunner Bot

You can start the EdgeRunner bot either locally or on a deployed server by sending a POST request to the appropriate endpoint with your bot configuration.

### Start Bot Locally

```bash
curl --location 'http://localhost:9090/edgerunner/start' \
--header 'Content-Type: application/json' \
--data '{
    "provider": {
        "userId": "user_30I2I43w4GgKpp0wHILCzs6HJmU"
    },
    "bookmaker": {
        "username": "07033054766",
        "password": "A1N2S3I4"
    },
    "edgerunner": {
        "fixedStake": {
            "enabled": true,
            "value": 10
        }
    },
    "proxy": {
        "enabled": true,
        "ip": "109.107.54.237:6001",
        "username": "UKwokPecgB",
        "password": "11453606"
    }
}'
```

### Start Bot on Deployed Server

```bash
curl --location 'https://edge-runner-p35d.onrender.com/edgerunner/start' \
--header 'Content-Type: application/json' \
--data '{
    "provider": {
        "userId": "user_30I2I43w4GgKpp0wHILCzs6HJmU"
    },
    "bookmaker": {
        "username": "07033054766",
        "password": "A1N2S3I4"
    },
    "edgerunner": {
        "fixedStake": {
            "enabled": true,
            "value": 10
        }
    },
    "proxy": {
        "enabled": true,
        "ip": "109.107.54.237:6001",
        "username": "UKwokPecgB",
        "password": "11453606"
    }
}'
```

---

## Docker Usage

You can run the EdgeRunner bot system using Docker to simplify setup and process management.

### Build and Run Docker Container

```bash
# Build the Docker image (run from project root)
docker build -t edgerunner-bot .

# Run container in foreground (logs output to terminal)
docker run --rm -p 9090:9090 edgerunner-bot

# Or run detached (in background)
docker run -d -p 9090:9090 --name edgerunner edgerunner-bot
```

### Viewing Logs

* If you run the container **without** the `-d` flag (foreground), logs appear directly in your terminal.
* If running **detached** (`-d`), container runs in background. To view logs, use:

```bash
docker logs -f edgerunner
```

### Stopping and Restarting Container

```bash
# Stop the running container
docker stop edgerunner

# Start it again (detached)
docker start edgerunner
```

