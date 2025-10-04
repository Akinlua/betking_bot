import path from "path";
import { Low } from "lowdb";
import { JSONFile } from "lowdb/node";
import fs from "fs/promises";
import pkg from "lodash";
const { merge } = pkg;

const defaultEdgerunnerState = {
  edgerunner: {
    stats: {
      totalBetsPlaced: 0,
      betsPlacedToday: 0,
      startingBalToday: null,
      lastBetDate: new Date().toISOString().slice(0, 10),
    },
  },
  bookmaker: {
    session: {
      balance: 0,
      lastRefreshTime: 0,
    },
    cookies: [],
    accessToken: null,
  },
};

export class Store {
  #db;
  #configPath; /**
   * @param {string} username The unique identifier for the bot (e.g., bookmaker username).
   * @param {string} botType The type of bot (e.g., 'edgerunner') to use for the directory path.
   * @param {string} baseDir The root data directory (defaults to a 'data' folder next to the project root).
   */

  constructor(username, botType = "edgerunner", baseDir = path.join(process.cwd(), "data")) {
    // Example path: <project_root>/data/edgerunner/07033054766.json
    const dataDir = path.join(baseDir, botType);
    this.#configPath = path.resolve(dataDir, `${username}.json`);

    const adapter = new JSONFile(this.#configPath);
    this.#db = new Low(adapter, defaultEdgerunnerState);
  } /**
   * Initializes the data store by ensuring the directory exists and reading the file.
   * This MUST be called before accessing or writing data.
   * @returns {Promise<void>}
   */

  async initialize() {
    // Ensure the data directory exists
    await fs.mkdir(path.dirname(this.#configPath), { recursive: true }); // Read the data from the file (or set to defaults if file is new/missing)

    await this.#db.read();
  } /**
   * Gets the entire persistent data object from the store.
   * @returns {Object} The complete bot data object.
   */

  getData() {
    return this.#db.data;
  } /**
   * Updates a specific top-level key of the bot's data and persists it.
   * Uses Lodash's deep merge for robust updates of nested objects (e.g., 'bookmaker' updates 'session').
   * @param {string} key The top-level key to update (e.g., 'bookmaker', 'edgerunner').
   * @param {Object|Array} value The data to set for that key.
   * @returns {Promise<void>}
   */

  async updateAndWrite(key, value) {
    if (this.#db.data.hasOwnProperty(key)) {
      // Use Lodash's merge for a deep, safe merge
      this.#db.data[key] = merge({}, this.#db.data[key], value);
      await this.#db.write(); // Persists the change
    } else {
      console.warn(`[BotDataStore] Attempted to update unknown key: ${key}`);
    }
  }

  getEdgerunnerStats() {
    return this.#db.data.edgerunner.stats || defaultEdgerunnerState.edgerunner.stats;
  }

  async setEdgerunnerStats(newStats) {
    const currentStats = this.getEdgerunnerStats();
    await this.updateAndWrite("edgerunner", { stats: { ...currentStats, ...newStats } });
  }

  /**
   * Retrieves the stored Puppeteer cookies for the bookmaker.
   * @returns {Array} The array of cookies.
   */
  getBookmakerCookies() {
    return this.#db.data.bookmaker.cookies || [];
  }

  /**
   * Persists a new set of Puppeteer cookies for the bookmaker.
   * @param {Array} cookies The cookies array to save.
   * @returns {Promise<void>}
   */
  async setBookmakerCookies(cookies) {
    await this.updateAndWrite("bookmaker", { cookies });
  }

  /**
   * Retrieves the stored session data (accessToken, balance, etc.) for the bookmaker.
   * @returns {Object} The bookmaker session object.
   */
  getBookmakerSession() {
    return this.#db.data.bookmaker.session;
  }

  /**
   * Retrieves the stored access token.
   * @returns {string|null} The access token string.
   */
  getAccessToken() {
    return this.#db.data.bookmaker.accessToken;
  }

  /**
   * Persists the access token.
   * @param {string} token The JWT access token string.
   * @returns {Promise<void>}
   */
  async setAccessToken(token) {
    // We use updateAndWrite with an object containing accessToken at the top level
    await this.updateAndWrite("bookmaker", { accessToken: token });
  }

  /**
   * Persists new or updated session data for the bookmaker.
   * This performs a deep merge with the existing session data.
   * @param {Object} sessionData The session properties to update (e.g., { accessToken: 'xyz' }).
   * @returns {Promise<void>}
   */
  async setBookmakerSession(sessionData) {
    // Create the structure needed for the deep merge in updateAndWrite
    const updatePayload = {
      session: sessionData,
    };
    await this.updateAndWrite("bookmaker", updatePayload);
  }

  /**
   * Deletes the persistent data store file for this bot.
   * Used primarily during failed bot setup for cleanup.
   * @returns {Promise<void>}
   */
  async deleteStoreFile() {
    try {
      await fs.unlink(this.#configPath);
      console.log(`[BotDataStore] Cleaned up data store file: ${this.#configPath}`);
    } catch (error) {
      if (error.code !== "ENOENT") {
        // Ignore if file already doesn't exist
        console.error(`[BotDataStore] Failed to delete store file ${this.#configPath}:`, error);
        throw error;
      }
    }
  }
}
