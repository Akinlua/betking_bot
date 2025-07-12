### POD
https://swordfish-production.up.railway.app/alerts/{user_id}?dropNotificationsCursor={drop_id}


### Bet 9ja
#### for bet9ja get info for event id (match)
sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetEvent?EVENTID={event_id}

#### bet 9ja for all sports
https://sports.bet9ja.com/desktop/feapi/PalimpsestAjax/GetSports?DISP=0

#### for bet 8ja searcher
https://apigw.bet9ja.com/sportsbook/search/SearchV2?source=desktop

# Project EdgeRunner

This project is an automated bot designed to find and process sports betting opportunities. It works by polling a data provider for alerts on odds changes and then scraping a bookmaker's website to find corresponding matches.

## Architecture & Data Flow

The application is built on a "Provider -> Bot -> Bookmaker" model, with each component having a clear responsibility. This separation of concerns makes the application maintainable and scalable.

### Core Components

1.  **Provider Service (`services/provider.service.js`)**
    * **Responsibility:** To act as the data source. It continuously polls an external alerts API to find new potential opportunities.
    * **Action:** When new alerts (games) are found, it sends them to the Bot Service to be added to a processing queue.
    * **Output:** For debugging purposes, it saves the latest raw data it receives to `data/provider_dump.json`.

2.  **Bot Service (`services/bot.service.js`)**
    * **Responsibility:** To be the main engine of the application. It manages an in-memory job queue to process each game from the provider one by one. This prevents overwhelming the bookmaker's site with too many requests at once.
    * **Action:** For each game in its queue, it calls the Bookmaker Service to find the corresponding match on the bookmaker's website. It also keeps track of processed events to avoid doing the same work twice.
    * **Output:** When a match is successfully found and verified, the bot saves the resulting data to `data/bot_dump.json`.

3.  **Bookmaker Service (`services/bookmaker.service.js`)**
    * **Responsibility:** To interact directly with the bookmaker's website (e.g., BetKing) using a headless Puppeteer browser instance.
    * **Action:** It provides simple functions like `getBetKingMatchDataByName` that the Bot Service can use. It handles the low-level complexity of running the browser, navigating pages, and parsing data.

### Data Flow

The entire process works as follows:

1.  The `server.js` application starts. It first initializes a single, shared Puppeteer browser instance using `core/browser.js`.
2.  The server then calls `startPolling()` from the **Provider Service**.
3.  The **Provider** begins polling the alerts API every few seconds.
4.  When the Provider finds new alerts, it sends them to the **Bot Service**.
5.  The **Bot Service** adds any new, unprocessed alerts to its internal queue and starts its worker if it's not already running.
6.  The **Bot Worker** pulls one game from the queue.
7.  The Bot tells the **Bookmaker Service** to find that specific game.
8.  The **Bookmaker Service** uses the shared Puppeteer browser to visit the bookmaker's site and find the match data.
9.  The result is returned to the Bot, which saves any successful finds and then waits for a short delay before processing the next item in its queue.
