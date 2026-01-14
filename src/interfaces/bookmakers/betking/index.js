import Fuse from "fuse.js";
import { URLSearchParams } from "url";
import chalk from "chalk";
import { AuthenticationError } from "../../../core/errors.js";
import fs from "fs";
import path from "path";

class BetKingBookmaker {
  constructor(config, browser, edgeRunnerStore) {
    this.config = config;
    this.browser = browser;
    this.botStore = edgeRunnerStore;
    this.state = {
      status: this.constructor.Status.INITIALIZING,
      message: "Bot has just started",
    };
    // Note: Sport IDs are defined for the provider's system.
    // - sportId=1: Football
    // - sportId=3: Basketball (provider); corresponds to bookmaker sportId=2
    this.sportIdMapper = {
      1: "F", // Football
      3: "B", // Basketball
    };

    this.lineTypeMapper = {
      money_line: {
        name: "money_line",
        sport: {
          1: {
            "*": { label: "1X2", outcome: { home: "1", draw: "X", away: "2" } },
          },
          3: { "*": { label: "Moneyline", outcome: { home: "1", away: "2" } } },
        },
      },
      totals: {
        name: "total",
        sport: {
          1: {
            "*": {
              label: "Total Goals",
              outcome: { over: "Over", under: "Under" },
            },
          },
          3: {
            "*": {
              label: "Total (Incl. Overtime)",
              outcome: { over: "Over", under: "Under" },
            },
          },
        },
      },
      spreads: {
        name: "handicap",
        sport: {
          1: {
            "*": { label: "Handicap", outcome: { home: "Home", away: "Away" } },
            bridge: {
              // --- Positive Asian Handicaps (+ AH) ---
              0.5: {
                home: {
                  provider: { line: "0.5", outcome: "home" },
                  bookmaker: { specialValue: "1:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "1.5", outcome: "away" },
                  bookmaker: { specialValue: "1:0", outcome: "Away" },
                },
              },
              1.5: {
                home: {
                  provider: { line: "1.5", outcome: "home" },
                  bookmaker: { specialValue: "2:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "2.5", outcome: "away" },
                  bookmaker: { specialValue: "2:0", outcome: "Away" },
                },
              },
              2.5: {
                home: {
                  provider: { line: "2.5", outcome: "home" },
                  bookmaker: { specialValue: "3:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "3.5", outcome: "away" },
                  bookmaker: { specialValue: "3:0", outcome: "Away" },
                },
              },
              3.5: {
                home: {
                  provider: { line: "3.5", outcome: "home" },
                  bookmaker: { specialValue: "4:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "4.5", outcome: "away" },
                  bookmaker: { specialValue: "4:0", outcome: "Away" },
                },
              },
              4.5: {
                home: {
                  provider: { line: "4.5", outcome: "home" },
                  bookmaker: { specialValue: "5:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "5.5", outcome: "away" },
                  bookmaker: { specialValue: "5:0", outcome: "Away" },
                },
              },
              5.5: {
                home: {
                  provider: { line: "5.5", outcome: "home" },
                  bookmaker: { specialValue: "6:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "6.5", outcome: "away" },
                  bookmaker: { specialValue: "6:0", outcome: "Away" },
                },
              },
              6.5: {
                home: {
                  provider: { line: "6.5", outcome: "home" },
                  bookmaker: { specialValue: "7:0", outcome: "Home" },
                },
                away: {
                  provider: { line: "7.5", outcome: "away" },
                  bookmaker: { specialValue: "7:0", outcome: "Away" },
                },
              },

              // --- Negative Asian Handicaps (- AH) ---
              "-1.5": {
                home: {
                  provider: { line: "-1.5", outcome: "home" },
                  bookmaker: { specialValue: "0:1", outcome: "Home" },
                },
                away: {
                  provider: { line: "-0.5", outcome: "away" },
                  bookmaker: { specialValue: "0:1", outcome: "Away" },
                },
              },
              "-2.5": {
                home: {
                  provider: { line: "-2.5", outcome: "home" },
                  bookmaker: { specialValue: "0:2", outcome: "Home" },
                },
                away: {
                  provider: { line: "-1.5", outcome: "away" },
                  bookmaker: { specialValue: "0:2", outcome: "Away" },
                },
              },
              "-3.5": {
                home: {
                  provider: { line: "-3.5", outcome: "home" },
                  bookmaker: { specialValue: "0:3", outcome: "Home" },
                },
                away: {
                  provider: { line: "-2.5", outcome: "away" },
                  bookmaker: { specialValue: "0:3", outcome: "Away" },
                },
              },
              "-4.5": {
                home: {
                  provider: { line: "-4.5", outcome: "home" },
                  bookmaker: { specialValue: "0:4", outcome: "Home" },
                },
                away: {
                  provider: { line: "-3.5", outcome: "away" },
                  bookmaker: { specialValue: "0:4", outcome: "Away" },
                },
              },
              "-5.5": {
                home: {
                  provider: { line: "-5.5", outcome: "home" },
                  bookmaker: { specialValue: "0:5", outcome: "Home" },
                },
                away: {
                  provider: { line: "-4.5", outcome: "away" },
                  bookmaker: { specialValue: "0:5", outcome: "Away" },
                },
              },
              "-6.5": {
                home: {
                  provider: { line: "-6.5", outcome: "home" },
                  bookmaker: { specialValue: "0:6", outcome: "Home" },
                },
                away: {
                  provider: { line: "-5.5", outcome: "away" },
                  bookmaker: { specialValue: "0:6", outcome: "Away" },
                },
              },

              // --- Special Cases ---
              "0.0": {
                home: {
                  provider: { line: "0.0", outcome: "home" },
                  bookmaker: { specialValue: "0", outcome: "1 DNB" },
                },
                away: {
                  provider: { line: "0.0", outcome: "away" },
                  bookmaker: { specialValue: "0", outcome: "2 DNB" },
                },
              },
            },
          },
          3: {
            "*": {
              label: "Handicap (Incl. Overtime)",
              outcome: { home: "1 AH", away: "2 AH" },
            },
            bridge: {
              // --- SPECIAL CASE
              "0.0": {
                home: {
                  provider: { line: "0.0", outcome: "home" },
                  bookmaker: { specialValue: "0", outcome: "1 DNB" },
                },
                away: {
                  provider: { line: "0.0", outcome: "away" },
                  bookmaker: { specialValue: "0", outcome: "2 DNB" },
                },
              },

              // --- Positive Handicaps (+0.5 to +50.0) ---
              0.5: {
                home: {
                  provider: { line: "0.5", outcome: "home" },
                  bookmaker: { specialValue: "0.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "0.5", outcome: "away" },
                  bookmaker: { specialValue: "0.5 : 0", outcome: "2 AH" },
                },
              },
              "1.0": {
                home: {
                  provider: { line: "1.0", outcome: "home" },
                  bookmaker: { specialValue: "1.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "1.0", outcome: "away" },
                  bookmaker: { specialValue: "1.0 : 0", outcome: "2 AH" },
                },
              },
              1.5: {
                home: {
                  provider: { line: "1.5", outcome: "home" },
                  bookmaker: { specialValue: "1.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "1.5", outcome: "away" },
                  bookmaker: { specialValue: "1.5 : 0", outcome: "2 AH" },
                },
              },
              "2.0": {
                home: {
                  provider: { line: "2.0", outcome: "home" },
                  bookmaker: { specialValue: "2.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "2.0", outcome: "away" },
                  bookmaker: { specialValue: "2.0 : 0", outcome: "2 AH" },
                },
              },
              2.5: {
                home: {
                  provider: { line: "2.5", outcome: "home" },
                  bookmaker: { specialValue: "2.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "2.5", outcome: "away" },
                  bookmaker: { specialValue: "2.5 : 0", outcome: "2 AH" },
                },
              },
              "3.0": {
                home: {
                  provider: { line: "3.0", outcome: "home" },
                  bookmaker: { specialValue: "3.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "3.0", outcome: "away" },
                  bookmaker: { specialValue: "3.0 : 0", outcome: "2 AH" },
                },
              },
              3.5: {
                home: {
                  provider: { line: "3.5", outcome: "home" },
                  bookmaker: { specialValue: "3.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "3.5", outcome: "away" },
                  bookmaker: { specialValue: "3.5 : 0", outcome: "2 AH" },
                },
              },
              "4.0": {
                home: {
                  provider: { line: "4.0", outcome: "home" },
                  bookmaker: { specialValue: "4.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "4.0", outcome: "away" },
                  bookmaker: { specialValue: "4.0 : 0", outcome: "2 AH" },
                },
              },
              4.5: {
                home: {
                  provider: { line: "4.5", outcome: "home" },
                  bookmaker: { specialValue: "4.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "4.5", outcome: "away" },
                  bookmaker: { specialValue: "4.5 : 0", outcome: "2 AH" },
                },
              },
              "5.0": {
                home: {
                  provider: { line: "5.0", outcome: "home" },
                  bookmaker: { specialValue: "5.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "5.0", outcome: "away" },
                  bookmaker: { specialValue: "5.0 : 0", outcome: "2 AH" },
                },
              },
              5.5: {
                home: {
                  provider: { line: "5.5", outcome: "home" },
                  bookmaker: { specialValue: "5.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "5.5", outcome: "away" },
                  bookmaker: { specialValue: "5.5 : 0", outcome: "2 AH" },
                },
              },
              "6.0": {
                home: {
                  provider: { line: "6.0", outcome: "home" },
                  bookmaker: { specialValue: "6.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "6.0", outcome: "away" },
                  bookmaker: { specialValue: "6.0 : 0", outcome: "2 AH" },
                },
              },
              6.5: {
                home: {
                  provider: { line: "6.5", outcome: "home" },
                  bookmaker: { specialValue: "6.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "6.5", outcome: "away" },
                  bookmaker: { specialValue: "6.5 : 0", outcome: "2 AH" },
                },
              },
              "7.0": {
                home: {
                  provider: { line: "7.0", outcome: "home" },
                  bookmaker: { specialValue: "7.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "7.0", outcome: "away" },
                  bookmaker: { specialValue: "7.0 : 0", outcome: "2 AH" },
                },
              },
              7.5: {
                home: {
                  provider: { line: "7.5", outcome: "home" },
                  bookmaker: { specialValue: "7.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "7.5", outcome: "away" },
                  bookmaker: { specialValue: "7.5 : 0", outcome: "2 AH" },
                },
              },
              "8.0": {
                home: {
                  provider: { line: "8.0", outcome: "home" },
                  bookmaker: { specialValue: "8.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "8.0", outcome: "away" },
                  bookmaker: { specialValue: "8.0 : 0", outcome: "2 AH" },
                },
              },
              8.5: {
                home: {
                  provider: { line: "8.5", outcome: "home" },
                  bookmaker: { specialValue: "8.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "8.5", outcome: "away" },
                  bookmaker: { specialValue: "8.5 : 0", outcome: "2 AH" },
                },
              },
              "9.0": {
                home: {
                  provider: { line: "9.0", outcome: "home" },
                  bookmaker: { specialValue: "9.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "9.0", outcome: "away" },
                  bookmaker: { specialValue: "9.0 : 0", outcome: "2 AH" },
                },
              },
              9.5: {
                home: {
                  provider: { line: "9.5", outcome: "home" },
                  bookmaker: { specialValue: "9.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "9.5", outcome: "away" },
                  bookmaker: { specialValue: "9.5 : 0", outcome: "2 AH" },
                },
              },
              "10.0": {
                home: {
                  provider: { line: "10.0", outcome: "home" },
                  bookmaker: { specialValue: "10.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "10.0", outcome: "away" },
                  bookmaker: { specialValue: "10.0 : 0", outcome: "2 AH" },
                },
              },
              10.5: {
                home: {
                  provider: { line: "10.5", outcome: "home" },
                  bookmaker: { specialValue: "10.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "10.5", outcome: "away" },
                  bookmaker: { specialValue: "10.5 : 0", outcome: "2 AH" },
                },
              },
              "11.0": {
                home: {
                  provider: { line: "11.0", outcome: "home" },
                  bookmaker: { specialValue: "11.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "11.0", outcome: "away" },
                  bookmaker: { specialValue: "11.0 : 0", outcome: "2 AH" },
                },
              },
              11.5: {
                home: {
                  provider: { line: "11.5", outcome: "home" },
                  bookmaker: { specialValue: "11.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "11.5", outcome: "away" },
                  bookmaker: { specialValue: "11.5 : 0", outcome: "2 AH" },
                },
              },
              "12.0": {
                home: {
                  provider: { line: "12.0", outcome: "home" },
                  bookmaker: { specialValue: "12.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "12.0", outcome: "away" },
                  bookmaker: { specialValue: "12.0 : 0", outcome: "2 AH" },
                },
              },
              12.5: {
                home: {
                  provider: { line: "12.5", outcome: "home" },
                  bookmaker: { specialValue: "12.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "12.5", outcome: "away" },
                  bookmaker: { specialValue: "12.5 : 0", outcome: "2 AH" },
                },
              },
              "13.0": {
                home: {
                  provider: { line: "13.0", outcome: "home" },
                  bookmaker: { specialValue: "13.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "13.0", outcome: "away" },
                  bookmaker: { specialValue: "13.0 : 0", outcome: "2 AH" },
                },
              },
              13.5: {
                home: {
                  provider: { line: "13.5", outcome: "home" },
                  bookmaker: { specialValue: "13.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "13.5", outcome: "away" },
                  bookmaker: { specialValue: "13.5 : 0", outcome: "2 AH" },
                },
              },
              "14.0": {
                home: {
                  provider: { line: "14.0", outcome: "home" },
                  bookmaker: { specialValue: "14.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "14.0", outcome: "away" },
                  bookmaker: { specialValue: "14.0 : 0", outcome: "2 AH" },
                },
              },
              14.5: {
                home: {
                  provider: { line: "14.5", outcome: "home" },
                  bookmaker: { specialValue: "14.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "14.5", outcome: "away" },
                  bookmaker: { specialValue: "14.5 : 0", outcome: "2 AH" },
                },
              },
              "15.0": {
                home: {
                  provider: { line: "15.0", outcome: "home" },
                  bookmaker: { specialValue: "15.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "15.0", outcome: "away" },
                  bookmaker: { specialValue: "15.0 : 0", outcome: "2 AH" },
                },
              },
              15.5: {
                home: {
                  provider: { line: "15.5", outcome: "home" },
                  bookmaker: { specialValue: "15.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "15.5", outcome: "away" },
                  bookmaker: { specialValue: "15.5 : 0", outcome: "2 AH" },
                },
              },
              "16.0": {
                home: {
                  provider: { line: "16.0", outcome: "home" },
                  bookmaker: { specialValue: "16.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "16.0", outcome: "away" },
                  bookmaker: { specialValue: "16.0 : 0", outcome: "2 AH" },
                },
              },
              16.5: {
                home: {
                  provider: { line: "16.5", outcome: "home" },
                  bookmaker: { specialValue: "16.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "16.5", outcome: "away" },
                  bookmaker: { specialValue: "16.5 : 0", outcome: "2 AH" },
                },
              },
              "17.0": {
                home: {
                  provider: { line: "17.0", outcome: "home" },
                  bookmaker: { specialValue: "17.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "17.0", outcome: "away" },
                  bookmaker: { specialValue: "17.0 : 0", outcome: "2 AH" },
                },
              },
              17.5: {
                home: {
                  provider: { line: "17.5", outcome: "home" },
                  bookmaker: { specialValue: "17.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "17.5", outcome: "away" },
                  bookmaker: { specialValue: "17.5 : 0", outcome: "2 AH" },
                },
              },
              "18.0": {
                home: {
                  provider: { line: "18.0", outcome: "home" },
                  bookmaker: { specialValue: "18.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "18.0", outcome: "away" },
                  bookmaker: { specialValue: "18.0 : 0", outcome: "2 AH" },
                },
              },
              18.5: {
                home: {
                  provider: { line: "18.5", outcome: "home" },
                  bookmaker: { specialValue: "18.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "18.5", outcome: "away" },
                  bookmaker: { specialValue: "18.5 : 0", outcome: "2 AH" },
                },
              },
              "19.0": {
                home: {
                  provider: { line: "19.0", outcome: "home" },
                  bookmaker: { specialValue: "19.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "19.0", outcome: "away" },
                  bookmaker: { specialValue: "19.0 : 0", outcome: "2 AH" },
                },
              },
              19.5: {
                home: {
                  provider: { line: "19.5", outcome: "home" },
                  bookmaker: { specialValue: "19.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "19.5", outcome: "away" },
                  bookmaker: { specialValue: "19.5 : 0", outcome: "2 AH" },
                },
              },
              "20.0": {
                home: {
                  provider: { line: "20.0", outcome: "home" },
                  bookmaker: { specialValue: "20.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "20.0", outcome: "away" },
                  bookmaker: { specialValue: "20.0 : 0", outcome: "2 AH" },
                },
              },
              20.5: {
                home: {
                  provider: { line: "20.5", outcome: "home" },
                  bookmaker: { specialValue: "20.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "20.5", outcome: "away" },
                  bookmaker: { specialValue: "20.5 : 0", outcome: "2 AH" },
                },
              },
              "21.0": {
                home: {
                  provider: { line: "21.0", outcome: "home" },
                  bookmaker: { specialValue: "21.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "21.0", outcome: "away" },
                  bookmaker: { specialValue: "21.0 : 0", outcome: "2 AH" },
                },
              },
              21.5: {
                home: {
                  provider: { line: "21.5", outcome: "home" },
                  bookmaker: { specialValue: "21.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "21.5", outcome: "away" },
                  bookmaker: { specialValue: "21.5 : 0", outcome: "2 AH" },
                },
              },
              "22.0": {
                home: {
                  provider: { line: "22.0", outcome: "home" },
                  bookmaker: { specialValue: "22.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "22.0", outcome: "away" },
                  bookmaker: { specialValue: "22.0 : 0", outcome: "2 AH" },
                },
              },
              22.5: {
                home: {
                  provider: { line: "22.5", outcome: "home" },
                  bookmaker: { specialValue: "22.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "22.5", outcome: "away" },
                  bookmaker: { specialValue: "22.5 : 0", outcome: "2 AH" },
                },
              },
              "23.0": {
                home: {
                  provider: { line: "23.0", outcome: "home" },
                  bookmaker: { specialValue: "23.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "23.0", outcome: "away" },
                  bookmaker: { specialValue: "23.0 : 0", outcome: "2 AH" },
                },
              },
              23.5: {
                home: {
                  provider: { line: "23.5", outcome: "home" },
                  bookmaker: { specialValue: "23.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "23.5", outcome: "away" },
                  bookmaker: { specialValue: "23.5 : 0", outcome: "2 AH" },
                },
              },
              "24.0": {
                home: {
                  provider: { line: "24.0", outcome: "home" },
                  bookmaker: { specialValue: "24.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "24.0", outcome: "away" },
                  bookmaker: { specialValue: "24.0 : 0", outcome: "2 AH" },
                },
              },
              24.5: {
                home: {
                  provider: { line: "24.5", outcome: "home" },
                  bookmaker: { specialValue: "24.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "24.5", outcome: "away" },
                  bookmaker: { specialValue: "24.5 : 0", outcome: "2 AH" },
                },
              },
              "25.0": {
                home: {
                  provider: { line: "25.0", outcome: "home" },
                  bookmaker: { specialValue: "25.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "25.0", outcome: "away" },
                  bookmaker: { specialValue: "25.0 : 0", outcome: "2 AH" },
                },
              },
              25.5: {
                home: {
                  provider: { line: "25.5", outcome: "home" },
                  bookmaker: { specialValue: "25.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "25.5", outcome: "away" },
                  bookmaker: { specialValue: "25.5 : 0", outcome: "2 AH" },
                },
              },
              "26.0": {
                home: {
                  provider: { line: "26.0", outcome: "home" },
                  bookmaker: { specialValue: "26.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "26.0", outcome: "away" },
                  bookmaker: { specialValue: "26.0 : 0", outcome: "2 AH" },
                },
              },
              26.5: {
                home: {
                  provider: { line: "26.5", outcome: "home" },
                  bookmaker: { specialValue: "26.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "26.5", outcome: "away" },
                  bookmaker: { specialValue: "26.5 : 0", outcome: "2 AH" },
                },
              },
              "27.0": {
                home: {
                  provider: { line: "27.0", outcome: "home" },
                  bookmaker: { specialValue: "27.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "27.0", outcome: "away" },
                  bookmaker: { specialValue: "27.0 : 0", outcome: "2 AH" },
                },
              },
              27.5: {
                home: {
                  provider: { line: "27.5", outcome: "home" },
                  bookmaker: { specialValue: "27.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "27.5", outcome: "away" },
                  bookmaker: { specialValue: "27.5 : 0", outcome: "2 AH" },
                },
              },
              "28.0": {
                home: {
                  provider: { line: "28.0", outcome: "home" },
                  bookmaker: { specialValue: "28.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "28.0", outcome: "away" },
                  bookmaker: { specialValue: "28.0 : 0", outcome: "2 AH" },
                },
              },
              28.5: {
                home: {
                  provider: { line: "28.5", outcome: "home" },
                  bookmaker: { specialValue: "28.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "28.5", outcome: "away" },
                  bookmaker: { specialValue: "28.5 : 0", outcome: "2 AH" },
                },
              },
              "29.0": {
                home: {
                  provider: { line: "29.0", outcome: "home" },
                  bookmaker: { specialValue: "29.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "29.0", outcome: "away" },
                  bookmaker: { specialValue: "29.0 : 0", outcome: "2 AH" },
                },
              },
              29.5: {
                home: {
                  provider: { line: "29.5", outcome: "home" },
                  bookmaker: { specialValue: "29.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "29.5", outcome: "away" },
                  bookmaker: { specialValue: "29.5 : 0", outcome: "2 AH" },
                },
              },
              "30.0": {
                home: {
                  provider: { line: "30.0", outcome: "home" },
                  bookmaker: { specialValue: "30.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "30.0", outcome: "away" },
                  bookmaker: { specialValue: "30.0 : 0", outcome: "2 AH" },
                },
              },
              30.5: {
                home: {
                  provider: { line: "30.5", outcome: "home" },
                  bookmaker: { specialValue: "30.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "30.5", outcome: "away" },
                  bookmaker: { specialValue: "30.5 : 0", outcome: "2 AH" },
                },
              },
              "31.0": {
                home: {
                  provider: { line: "31.0", outcome: "home" },
                  bookmaker: { specialValue: "31.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "31.0", outcome: "away" },
                  bookmaker: { specialValue: "31.0 : 0", outcome: "2 AH" },
                },
              },
              31.5: {
                home: {
                  provider: { line: "31.5", outcome: "home" },
                  bookmaker: { specialValue: "31.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "31.5", outcome: "away" },
                  bookmaker: { specialValue: "31.5 : 0", outcome: "2 AH" },
                },
              },
              "32.0": {
                home: {
                  provider: { line: "32.0", outcome: "home" },
                  bookmaker: { specialValue: "32.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "32.0", outcome: "away" },
                  bookmaker: { specialValue: "32.0 : 0", outcome: "2 AH" },
                },
              },
              32.5: {
                home: {
                  provider: { line: "32.5", outcome: "home" },
                  bookmaker: { specialValue: "32.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "32.5", outcome: "away" },
                  bookmaker: { specialValue: "32.5 : 0", outcome: "2 AH" },
                },
              },
              "33.0": {
                home: {
                  provider: { line: "33.0", outcome: "home" },
                  bookmaker: { specialValue: "33.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "33.0", outcome: "away" },
                  bookmaker: { specialValue: "33.0 : 0", outcome: "2 AH" },
                },
              },
              33.5: {
                home: {
                  provider: { line: "33.5", outcome: "home" },
                  bookmaker: { specialValue: "33.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "33.5", outcome: "away" },
                  bookmaker: { specialValue: "33.5 : 0", outcome: "2 AH" },
                },
              },
              "34.0": {
                home: {
                  provider: { line: "34.0", outcome: "home" },
                  bookmaker: { specialValue: "34.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "34.0", outcome: "away" },
                  bookmaker: { specialValue: "34.0 : 0", outcome: "2 AH" },
                },
              },
              34.5: {
                home: {
                  provider: { line: "34.5", outcome: "home" },
                  bookmaker: { specialValue: "34.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "34.5", outcome: "away" },
                  bookmaker: { specialValue: "34.5 : 0", outcome: "2 AH" },
                },
              },
              "35.0": {
                home: {
                  provider: { line: "35.0", outcome: "home" },
                  bookmaker: { specialValue: "35.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "35.0", outcome: "away" },
                  bookmaker: { specialValue: "35.0 : 0", outcome: "2 AH" },
                },
              },
              35.5: {
                home: {
                  provider: { line: "35.5", outcome: "home" },
                  bookmaker: { specialValue: "35.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "35.5", outcome: "away" },
                  bookmaker: { specialValue: "35.5 : 0", outcome: "2 AH" },
                },
              },
              "36.0": {
                home: {
                  provider: { line: "36.0", outcome: "home" },
                  bookmaker: { specialValue: "36.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "36.0", outcome: "away" },
                  bookmaker: { specialValue: "36.0 : 0", outcome: "2 AH" },
                },
              },
              36.5: {
                home: {
                  provider: { line: "36.5", outcome: "home" },
                  bookmaker: { specialValue: "36.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "36.5", outcome: "away" },
                  bookmaker: { specialValue: "36.5 : 0", outcome: "2 AH" },
                },
              },
              "37.0": {
                home: {
                  provider: { line: "37.0", outcome: "home" },
                  bookmaker: { specialValue: "37.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "37.0", outcome: "away" },
                  bookmaker: { specialValue: "37.0 : 0", outcome: "2 AH" },
                },
              },
              37.5: {
                home: {
                  provider: { line: "37.5", outcome: "home" },
                  bookmaker: { specialValue: "37.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "37.5", outcome: "away" },
                  bookmaker: { specialValue: "37.5 : 0", outcome: "2 AH" },
                },
              },
              "38.0": {
                home: {
                  provider: { line: "38.0", outcome: "home" },
                  bookmaker: { specialValue: "38.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "38.0", outcome: "away" },
                  bookmaker: { specialValue: "38.0 : 0", outcome: "2 AH" },
                },
              },
              38.5: {
                home: {
                  provider: { line: "38.5", outcome: "home" },
                  bookmaker: { specialValue: "38.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "38.5", outcome: "away" },
                  bookmaker: { specialValue: "38.5 : 0", outcome: "2 AH" },
                },
              },
              "39.0": {
                home: {
                  provider: { line: "39.0", outcome: "home" },
                  bookmaker: { specialValue: "39.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "39.0", outcome: "away" },
                  bookmaker: { specialValue: "39.0 : 0", outcome: "2 AH" },
                },
              },
              39.5: {
                home: {
                  provider: { line: "39.5", outcome: "home" },
                  bookmaker: { specialValue: "39.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "39.5", outcome: "away" },
                  bookmaker: { specialValue: "39.5 : 0", outcome: "2 AH" },
                },
              },
              "40.0": {
                home: {
                  provider: { line: "40.0", outcome: "home" },
                  bookmaker: { specialValue: "40.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "40.0", outcome: "away" },
                  bookmaker: { specialValue: "40.0 : 0", outcome: "2 AH" },
                },
              },
              40.5: {
                home: {
                  provider: { line: "40.5", outcome: "home" },
                  bookmaker: { specialValue: "40.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "40.5", outcome: "away" },
                  bookmaker: { specialValue: "40.5 : 0", outcome: "2 AH" },
                },
              },
              "41.0": {
                home: {
                  provider: { line: "41.0", outcome: "home" },
                  bookmaker: { specialValue: "41.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "41.0", outcome: "away" },
                  bookmaker: { specialValue: "41.0 : 0", outcome: "2 AH" },
                },
              },
              41.5: {
                home: {
                  provider: { line: "41.5", outcome: "home" },
                  bookmaker: { specialValue: "41.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "41.5", outcome: "away" },
                  bookmaker: { specialValue: "41.5 : 0", outcome: "2 AH" },
                },
              },
              "42.0": {
                home: {
                  provider: { line: "42.0", outcome: "home" },
                  bookmaker: { specialValue: "42.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "42.0", outcome: "away" },
                  bookmaker: { specialValue: "42.0 : 0", outcome: "2 AH" },
                },
              },
              42.5: {
                home: {
                  provider: { line: "42.5", outcome: "home" },
                  bookmaker: { specialValue: "42.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "42.5", outcome: "away" },
                  bookmaker: { specialValue: "42.5 : 0", outcome: "2 AH" },
                },
              },
              "43.0": {
                home: {
                  provider: { line: "43.0", outcome: "home" },
                  bookmaker: { specialValue: "43.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "43.0", outcome: "away" },
                  bookmaker: { specialValue: "43.0 : 0", outcome: "2 AH" },
                },
              },
              43.5: {
                home: {
                  provider: { line: "43.5", outcome: "home" },
                  bookmaker: { specialValue: "43.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "43.5", outcome: "away" },
                  bookmaker: { specialValue: "43.5 : 0", outcome: "2 AH" },
                },
              },
              "44.0": {
                home: {
                  provider: { line: "44.0", outcome: "home" },
                  bookmaker: { specialValue: "44.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "44.0", outcome: "away" },
                  bookmaker: { specialValue: "44.0 : 0", outcome: "2 AH" },
                },
              },
              44.5: {
                home: {
                  provider: { line: "44.5", outcome: "home" },
                  bookmaker: { specialValue: "44.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "44.5", outcome: "away" },
                  bookmaker: { specialValue: "44.5 : 0", outcome: "2 AH" },
                },
              },
              "45.0": {
                home: {
                  provider: { line: "45.0", outcome: "home" },
                  bookmaker: { specialValue: "45.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "45.0", outcome: "away" },
                  bookmaker: { specialValue: "45.0 : 0", outcome: "2 AH" },
                },
              },
              45.5: {
                home: {
                  provider: { line: "45.5", outcome: "home" },
                  bookmaker: { specialValue: "45.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "45.5", outcome: "away" },
                  bookmaker: { specialValue: "45.5 : 0", outcome: "2 AH" },
                },
              },
              "46.0": {
                home: {
                  provider: { line: "46.0", outcome: "home" },
                  bookmaker: { specialValue: "46.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "46.0", outcome: "away" },
                  bookmaker: { specialValue: "46.0 : 0", outcome: "2 AH" },
                },
              },
              46.5: {
                home: {
                  provider: { line: "46.5", outcome: "home" },
                  bookmaker: { specialValue: "46.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "46.5", outcome: "away" },
                  bookmaker: { specialValue: "46.5 : 0", outcome: "2 AH" },
                },
              },
              "47.0": {
                home: {
                  provider: { line: "47.0", outcome: "home" },
                  bookmaker: { specialValue: "47.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "47.0", outcome: "away" },
                  bookmaker: { specialValue: "47.0 : 0", outcome: "2 AH" },
                },
              },
              47.5: {
                home: {
                  provider: { line: "47.5", outcome: "home" },
                  bookmaker: { specialValue: "47.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "47.5", outcome: "away" },
                  bookmaker: { specialValue: "47.5 : 0", outcome: "2 AH" },
                },
              },
              "48.0": {
                home: {
                  provider: { line: "48.0", outcome: "home" },
                  bookmaker: { specialValue: "48.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "48.0", outcome: "away" },
                  bookmaker: { specialValue: "48.0 : 0", outcome: "2 AH" },
                },
              },
              48.5: {
                home: {
                  provider: { line: "48.5", outcome: "home" },
                  bookmaker: { specialValue: "48.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "48.5", outcome: "away" },
                  bookmaker: { specialValue: "48.5 : 0", outcome: "2 AH" },
                },
              },
              "49.0": {
                home: {
                  provider: { line: "49.0", outcome: "home" },
                  bookmaker: { specialValue: "49.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "49.0", outcome: "away" },
                  bookmaker: { specialValue: "49.0 : 0", outcome: "2 AH" },
                },
              },
              49.5: {
                home: {
                  provider: { line: "49.5", outcome: "home" },
                  bookmaker: { specialValue: "49.5 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "49.5", outcome: "away" },
                  bookmaker: { specialValue: "49.5 : 0", outcome: "2 AH" },
                },
              },
              "50.0": {
                home: {
                  provider: { line: "50.0", outcome: "home" },
                  bookmaker: { specialValue: "50.0 : 0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "50.0", outcome: "away" },
                  bookmaker: { specialValue: "50.0 : 0", outcome: "2 AH" },
                },
              },

              // --- Negative Handicaps (-0.5 to -50.0) ---
              "-0.5": {
                home: {
                  provider: { line: "-0.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 0.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-0.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 0.5", outcome: "2 AH" },
                },
              },
              "-1.0": {
                home: {
                  provider: { line: "-1.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 1.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-1.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 1.0", outcome: "2 AH" },
                },
              },
              "-1.5": {
                home: {
                  provider: { line: "-1.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 1.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-1.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 1.5", outcome: "2 AH" },
                },
              },
              "-2.0": {
                home: {
                  provider: { line: "-2.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 2.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-2.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 2.0", outcome: "2 AH" },
                },
              },
              "-2.5": {
                home: {
                  provider: { line: "-2.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 2.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-2.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 2.5", outcome: "2 AH" },
                },
              },
              "-3.0": {
                home: {
                  provider: { line: "-3.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 3.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-3.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 3.0", outcome: "2 AH" },
                },
              },
              "-3.5": {
                home: {
                  provider: { line: "-3.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 3.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-3.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 3.5", outcome: "2 AH" },
                },
              },
              "-4.0": {
                home: {
                  provider: { line: "-4.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 4.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-4.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 4.0", outcome: "2 AH" },
                },
              },
              "-4.5": {
                home: {
                  provider: { line: "-4.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 4.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-4.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 4.5", outcome: "2 AH" },
                },
              },
              "-5.0": {
                home: {
                  provider: { line: "-5.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 5.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-5.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 5.0", outcome: "2 AH" },
                },
              },
              "-5.5": {
                home: {
                  provider: { line: "-5.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 5.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-5.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 5.5", outcome: "2 AH" },
                },
              },
              "-6.0": {
                home: {
                  provider: { line: "-6.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 6.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-6.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 6.0", outcome: "2 AH" },
                },
              },
              "-6.5": {
                home: {
                  provider: { line: "-6.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 6.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-6.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 6.5", outcome: "2 AH" },
                },
              },
              "-7.0": {
                home: {
                  provider: { line: "-7.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 7.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-7.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 7.0", outcome: "2 AH" },
                },
              },
              "-7.5": {
                home: {
                  provider: { line: "-7.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 7.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-7.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 7.5", outcome: "2 AH" },
                },
              },
              "-8.0": {
                home: {
                  provider: { line: "-8.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 8.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-8.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 8.0", outcome: "2 AH" },
                },
              },
              "-8.5": {
                home: {
                  provider: { line: "-8.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 8.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-8.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 8.5", outcome: "2 AH" },
                },
              },
              "-9.0": {
                home: {
                  provider: { line: "-9.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 9.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-9.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 9.0", outcome: "2 AH" },
                },
              },
              "-9.5": {
                home: {
                  provider: { line: "-9.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 9.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-9.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 9.5", outcome: "2 AH" },
                },
              },
              "-10.0": {
                home: {
                  provider: { line: "-10.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 10.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-10.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 10.0", outcome: "2 AH" },
                },
              },
              "-10.5": {
                home: {
                  provider: { line: "-10.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 10.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-10.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 10.5", outcome: "2 AH" },
                },
              },
              "-11.0": {
                home: {
                  provider: { line: "-11.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 11.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-11.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 11.0", outcome: "2 AH" },
                },
              },
              "-11.5": {
                home: {
                  provider: { line: "-11.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 11.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-11.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 11.5", outcome: "2 AH" },
                },
              },
              "-12.0": {
                home: {
                  provider: { line: "-12.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 12.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-12.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 12.0", outcome: "2 AH" },
                },
              },
              "-12.5": {
                home: {
                  provider: { line: "-12.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 12.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-12.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 12.5", outcome: "2 AH" },
                },
              },
              "-13.0": {
                home: {
                  provider: { line: "-13.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 13.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-13.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 13.0", outcome: "2 AH" },
                },
              },
              "-13.5": {
                home: {
                  provider: { line: "-13.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 13.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-13.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 13.5", outcome: "2 AH" },
                },
              },
              "-14.0": {
                home: {
                  provider: { line: "-14.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 14.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-14.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 14.0", outcome: "2 AH" },
                },
              },
              "-14.5": {
                home: {
                  provider: { line: "-14.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 14.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-14.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 14.5", outcome: "2 AH" },
                },
              },
              "-15.0": {
                home: {
                  provider: { line: "-15.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 15.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-15.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 15.0", outcome: "2 AH" },
                },
              },
              "-15.5": {
                home: {
                  provider: { line: "-15.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 15.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-15.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 15.5", outcome: "2 AH" },
                },
              },
              "-16.0": {
                home: {
                  provider: { line: "-16.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 16.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-16.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 16.0", outcome: "2 AH" },
                },
              },
              "-16.5": {
                home: {
                  provider: { line: "-16.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 16.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-16.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 16.5", outcome: "2 AH" },
                },
              },
              "-17.0": {
                home: {
                  provider: { line: "-17.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 17.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-17.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 17.0", outcome: "2 AH" },
                },
              },
              "-17.5": {
                home: {
                  provider: { line: "-17.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 17.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-17.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 17.5", outcome: "2 AH" },
                },
              },
              "-18.0": {
                home: {
                  provider: { line: "-18.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 18.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-18.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 18.0", outcome: "2 AH" },
                },
              },
              "-18.5": {
                home: {
                  provider: { line: "-18.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 18.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-18.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 18.5", outcome: "2 AH" },
                },
              },
              "-19.0": {
                home: {
                  provider: { line: "-19.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 19.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-19.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 19.0", outcome: "2 AH" },
                },
              },
              "-19.5": {
                home: {
                  provider: { line: "-19.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 19.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-19.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 19.5", outcome: "2 AH" },
                },
              },
              "-20.0": {
                home: {
                  provider: { line: "-20.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 20.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-20.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 20.0", outcome: "2 AH" },
                },
              },
              "-20.5": {
                home: {
                  provider: { line: "-20.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 20.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-20.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 20.5", outcome: "2 AH" },
                },
              },
              "-21.0": {
                home: {
                  provider: { line: "-21.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 21.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-21.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 21.0", outcome: "2 AH" },
                },
              },
              "-21.5": {
                home: {
                  provider: { line: "-21.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 21.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-21.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 21.5", outcome: "2 AH" },
                },
              },
              "-22.0": {
                home: {
                  provider: { line: "-22.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 22.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-22.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 22.0", outcome: "2 AH" },
                },
              },
              "-22.5": {
                home: {
                  provider: { line: "-22.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 22.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-22.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 22.5", outcome: "2 AH" },
                },
              },
              "-23.0": {
                home: {
                  provider: { line: "-23.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 23.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-23.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 23.0", outcome: "2 AH" },
                },
              },
              "-23.5": {
                home: {
                  provider: { line: "-23.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 23.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-23.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 23.5", outcome: "2 AH" },
                },
              },
              "-24.0": {
                home: {
                  provider: { line: "-24.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 24.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-24.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 24.0", outcome: "2 AH" },
                },
              },
              "-24.5": {
                home: {
                  provider: { line: "-24.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 24.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-24.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 24.5", outcome: "2 AH" },
                },
              },
              "-25.0": {
                home: {
                  provider: { line: "-25.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 25.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-25.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 25.0", outcome: "2 AH" },
                },
              },
              "-25.5": {
                home: {
                  provider: { line: "-25.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 25.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-25.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 25.5", outcome: "2 AH" },
                },
              },
              "-26.0": {
                home: {
                  provider: { line: "-26.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 26.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-26.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 26.0", outcome: "2 AH" },
                },
              },
              "-26.5": {
                home: {
                  provider: { line: "-26.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 26.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-26.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 26.5", outcome: "2 AH" },
                },
              },
              "-27.0": {
                home: {
                  provider: { line: "-27.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 27.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-27.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 27.0", outcome: "2 AH" },
                },
              },
              "-27.5": {
                home: {
                  provider: { line: "-27.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 27.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-27.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 27.5", outcome: "2 AH" },
                },
              },
              "-28.0": {
                home: {
                  provider: { line: "-28.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 28.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-28.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 28.0", outcome: "2 AH" },
                },
              },
              "-28.5": {
                home: {
                  provider: { line: "-28.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 28.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-28.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 28.5", outcome: "2 AH" },
                },
              },
              "-29.0": {
                home: {
                  provider: { line: "-29.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 29.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-29.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 29.0", outcome: "2 AH" },
                },
              },
              "-29.5": {
                home: {
                  provider: { line: "-29.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 29.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-29.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 29.5", outcome: "2 AH" },
                },
              },
              "-30.0": {
                home: {
                  provider: { line: "-30.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 30.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-30.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 30.0", outcome: "2 AH" },
                },
              },
              "-30.5": {
                home: {
                  provider: { line: "-30.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 30.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-30.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 30.5", outcome: "2 AH" },
                },
              },
              "-31.0": {
                home: {
                  provider: { line: "-31.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 31.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-31.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 31.0", outcome: "2 AH" },
                },
              },
              "-31.5": {
                home: {
                  provider: { line: "-31.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 31.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-31.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 31.5", outcome: "2 AH" },
                },
              },
              "-32.0": {
                home: {
                  provider: { line: "-32.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 32.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-32.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 32.0", outcome: "2 AH" },
                },
              },
              "-32.5": {
                home: {
                  provider: { line: "-32.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 32.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-32.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 32.5", outcome: "2 AH" },
                },
              },
              "-33.0": {
                home: {
                  provider: { line: "-33.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 33.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-33.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 33.0", outcome: "2 AH" },
                },
              },
              "-33.5": {
                home: {
                  provider: { line: "-33.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 33.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-33.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 33.5", outcome: "2 AH" },
                },
              },
              "-34.0": {
                home: {
                  provider: { line: "-34.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 34.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-34.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 34.0", outcome: "2 AH" },
                },
              },
              "-34.5": {
                home: {
                  provider: { line: "-34.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 34.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-34.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 34.5", outcome: "2 AH" },
                },
              },
              "-35.0": {
                home: {
                  provider: { line: "-35.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 35.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-35.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 35.0", outcome: "2 AH" },
                },
              },
              "-35.5": {
                home: {
                  provider: { line: "-35.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 35.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-35.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 35.5", outcome: "2 AH" },
                },
              },
              "-36.0": {
                home: {
                  provider: { line: "-36.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 36.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-36.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 36.0", outcome: "2 AH" },
                },
              },
              "-36.5": {
                home: {
                  provider: { line: "-36.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 36.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-36.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 36.5", outcome: "2 AH" },
                },
              },
              "-37.0": {
                home: {
                  provider: { line: "-37.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 37.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-37.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 37.0", outcome: "2 AH" },
                },
              },
              "-37.5": {
                home: {
                  provider: { line: "-37.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 37.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-37.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 37.5", outcome: "2 AH" },
                },
              },
              "-38.0": {
                home: {
                  provider: { line: "-38.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 38.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-38.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 38.0", outcome: "2 AH" },
                },
              },
              "-38.5": {
                home: {
                  provider: { line: "-38.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 38.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-38.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 38.5", outcome: "2 AH" },
                },
              },
              "-39.0": {
                home: {
                  provider: { line: "-39.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 39.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-39.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 39.0", outcome: "2 AH" },
                },
              },
              "-39.5": {
                home: {
                  provider: { line: "-39.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 39.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-39.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 39.5", outcome: "2 AH" },
                },
              },
              "-40.0": {
                home: {
                  provider: { line: "-40.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 40.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-40.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 40.0", outcome: "2 AH" },
                },
              },
              "-40.5": {
                home: {
                  provider: { line: "-40.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 40.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-40.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 40.5", outcome: "2 AH" },
                },
              },
              "-41.0": {
                home: {
                  provider: { line: "-41.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 41.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-41.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 41.0", outcome: "2 AH" },
                },
              },
              "-41.5": {
                home: {
                  provider: { line: "-41.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 41.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-41.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 41.5", outcome: "2 AH" },
                },
              },
              "-42.0": {
                home: {
                  provider: { line: "-42.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 42.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-42.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 42.0", outcome: "2 AH" },
                },
              },
              "-42.5": {
                home: {
                  provider: { line: "-42.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 42.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-42.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 42.5", outcome: "2 AH" },
                },
              },
              "-43.0": {
                home: {
                  provider: { line: "-43.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 43.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-43.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 43.0", outcome: "2 AH" },
                },
              },
              "-43.5": {
                home: {
                  provider: { line: "-43.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 43.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-43.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 43.5", outcome: "2 AH" },
                },
              },
              "-44.0": {
                home: {
                  provider: { line: "-44.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 44.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-44.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 44.0", outcome: "2 AH" },
                },
              },
              "-44.5": {
                home: {
                  provider: { line: "-44.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 44.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-44.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 44.5", outcome: "2 AH" },
                },
              },
              "-45.0": {
                home: {
                  provider: { line: "-45.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 45.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-45.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 45.0", outcome: "2 AH" },
                },
              },
              "-45.5": {
                home: {
                  provider: { line: "-45.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 45.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-45.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 45.5", outcome: "2 AH" },
                },
              },
              "-46.0": {
                home: {
                  provider: { line: "-46.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 46.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-46.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 46.0", outcome: "2 AH" },
                },
              },
              "-46.5": {
                home: {
                  provider: { line: "-46.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 46.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-46.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 46.5", outcome: "2 AH" },
                },
              },
              "-47.0": {
                home: {
                  provider: { line: "-47.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 47.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-47.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 47.0", outcome: "2 AH" },
                },
              },
              "-47.5": {
                home: {
                  provider: { line: "-47.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 47.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-47.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 47.5", outcome: "2 AH" },
                },
              },
              "-48.0": {
                home: {
                  provider: { line: "-48.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 48.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-48.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 48.0", outcome: "2 AH" },
                },
              },
              "-48.5": {
                home: {
                  provider: { line: "-48.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 48.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-48.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 48.5", outcome: "2 AH" },
                },
              },
              "-49.0": {
                home: {
                  provider: { line: "-49.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 49.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-49.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 49.0", outcome: "2 AH" },
                },
              },
              "-49.5": {
                home: {
                  provider: { line: "-49.5", outcome: "home" },
                  bookmaker: { specialValue: "0 : 49.5", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-49.5", outcome: "away" },
                  bookmaker: { specialValue: "0 : 49.5", outcome: "2 AH" },
                },
              },
              "-50.0": {
                home: {
                  provider: { line: "-50.0", outcome: "home" },
                  bookmaker: { specialValue: "0 : 50.0", outcome: "1 AH" },
                },
                away: {
                  provider: { line: "-50.0", outcome: "away" },
                  bookmaker: { specialValue: "0 : 50.0", outcome: "2 AH" },
                },
              },
            },
          },
        },
      },
      team_total: {
        name: "team total",
        sport: {
          1: {
            "*": {
              label: "Team Total Goals",
              outcome: { home: "Home", away: "Away" },
            },
          },
          3: {
            "*": {
              label: "Team Total (Incl. Overtime)",
              outcome: { home: "Home", away: "Away" },
            },
          },
        },
      },
    };
  }

  static Status = Object.freeze({
    IDLE: "IDLE",
    INITIALIZING: "INITIALIZING",
    AUTHENTICATING: "AUTHENTICATING",
    AUTHENTICATED: "AUTHENTICATED",
    UNAUTHENTICATED: "UNAUTHENTICATED",
    WORKING: "WORKING",
    SUCCESS: "SUCCESS",
    ERROR: "ERROR",
  });

  #areCookiesValid = async (cookies) => {
    const accessToken = cookies.find((c) => c.name === "accessToken");
    if (!accessToken) {
      console.log("[Bookmaker] No accessToken cookie found");
      return false;
    }
    const now = Math.floor(Date.now() / 1000); // Current time in seconds
    if (accessToken.expires && accessToken.expires < now) {
      console.log("[Bookmaker] accessToken cookie expired");
      return false;
    }
    console.log("[Bookmaker] accessToken cookie is valid until", new Date(accessToken.expires * 1000));
    return true;
  };

  async getBookmakerSessionValidity() {
    try {
      const cookies = this.botStore.getBookmakerCookies();
      if (!cookies || cookies.length === 0) {
        return false;
      }
      return await this.#areCookiesValid(cookies);
    } catch (error) {
      console.error("[Bookmaker] Error accessing store for session check:", error.message);
      return false;
    }
  }

  #fetchJsonFromApi = async (url) => {
    let page;
    try {
      page = await this.browser.newPage();
      await page.setExtraHTTPHeaders({
        "Cache-Control": "no-cache",
        Pragma: "no-cache",
      });
      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      if (!response.ok()) {
        throw new Error(`Request failed with status: ${response.status()}`);
      }
      let res = await response.json();
      return res;
    } catch (error) {
      console.error(`[Bookmaker] Error fetching API URL ${url}:`, error.message);
      return null;
    } finally {
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.close();
    }
  };

  #slugifyEventName = (name) => {
    if (!name) return "";
    return name
      .toLowerCase()
      .replace(/ & /g, " and ")
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  };

  #normalizeTeamName = (name) => {
    if (!name) return "";
    let cleanedName = name.replace(/\s*\([^)]*\)/g, "");
    cleanedName = cleanedName.replace(/\s*(u\d{2})\b/gi, "");
    const parts = cleanedName
      .toLowerCase()
      .split(/[ \/-]/)
      .filter((part) => part);
    let start = 0;
    let end = parts.length;
    while (start < end && parts[start].length < 3) {
      start++;
    }
    while (end > start && parts[end - 1].length < 3) {
      end--;
    }
    let meaningfulParts = parts.slice(start, end);
    if (!meaningfulParts.length) {
      meaningfulParts = [parts.reduce((longest, part) => (part.length > longest.length ? part : longest), "")];
      console.log(`[Bookmaker] No meaningful parts, using longest: "${meaningfulParts[0]}"`);
    }
    let normalized = meaningfulParts.join(" ");
    normalized = normalized.replace(/[.-]/g, " ");
    normalized = normalized.replace(/\s+/g, " ");
    normalized = normalized.trim();
    // console.log(`[Bookmaker] Final normalized name: "${normalized}"`);
    return normalized;
  };

  getStatus() {
    return this.state;
  }

  async getTeamDataById(matchId) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: `Fetching match data for ID: ${matchId}`,
    };
    try {
      if (!matchId || typeof matchId !== "string") return null;
      const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Match/${matchId}`;
      const data = await this.#fetchJsonFromApi(url);
      this.state = {
        status: this.constructor.Status.IDLE,
        message: `Successfully fetched data for ID: ${matchId}`,
      };
      return data;
    } catch (error) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Failed to fetch data: ${error.message}`,
      };
      throw error;
    }
  }

  async getTeamDataByName(searchTerm) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: `Searching for team: ${searchTerm}`,
    };
    try {
      if (!searchTerm || typeof searchTerm !== "string") return null;
      const formattedSearchTerm = encodeURIComponent(searchTerm.trim());
      const url = `https://sportsapicdn-mobile.betking.com/api/feeds/prematch/Search/lang/en?search=${formattedSearchTerm}`;
      const data = await this.#fetchJsonFromApi(url);
      const matches = Array.isArray(data) ? data : data.matches || data.results || [];
      const filteredMatches = matches.filter((match) => match.TeamHome && match.TeamAway);
      this.state = {
        status: this.constructor.Status.IDLE,
        message: `Found ${filteredMatches.length} matches for ${searchTerm}`,
      };
      return filteredMatches;
    } catch (error) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Failed to search for team: ${error.message}`,
      };
      throw error;
    }
  }

  async getMatchDataByTeamPair(home, away) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: `Searching for match: ${home} vs ${away}`,
    };

    if (!home || !away) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: "Missing home or away team name.",
      };
      return null;
    }

    const normalizedHome = this.#normalizeTeamName(home);
    const normalizedAway = this.#normalizeTeamName(away);
    const combinedSearchTerm = `${normalizedHome} - ${normalizedAway}`;

    try {
      // console.log(`[Bookmaker] Starting Searching for both "${home}" and "${away}"`);
      const homeResults = await this.getTeamDataByName(home);
      const awayResults = await this.getTeamDataByName(away);

      const allMatches = [...(homeResults || []), ...(awayResults || [])];
      const uniqueMatches = Array.from(new Map(allMatches.map((match) => [match.IDEvent, match])).values());

      if (!uniqueMatches.length) {
        console.log(`[Bookmaker] No matches found for either "${home}" or "${away}"`);
        return null;
      }

      console.log(`[Bookmaker] Search: "${normalizedHome}" vs "${normalizedAway}"`);
      const searchableMatches = uniqueMatches.map((match) => {
        const apiHome = this.#normalizeTeamName(match.TeamHome);
        const apiAway = this.#normalizeTeamName(match.TeamAway);
        return {
          ...match,
          combinedEventName: `${apiHome} - ${apiAway}`,
        };
      });

      const fuse = new Fuse(searchableMatches, {
        includeScore: true,
        threshold: 0.6,
        keys: ["combinedEventName"],
      });

      const results = fuse.search({
        $or: [{ combinedEventName: `${normalizedHome} - ${normalizedAway}` }, { combinedEventName: `${normalizedAway} - ${normalizedHome}` }],
      });
      console.log(
        `[Bookmaker] Search results for Teams ${combinedSearchTerm}`,
        results.map((r) => {
          const matchPercentage = (1 - r.score) * 100;
          return {
            matchConfidence: `${matchPercentage.toFixed(2)}%`,
            normalizedCombinedSearchTerm: `${combinedSearchTerm}`,
            normalizedCombinedEventName: `${r.item.combinedEventName}`,
            eventName: r.item.EventName,
          };
        }),
      );

      if (results.length === 0) {
        console.log(`[Bookmaker] No confident fuzzy match found.`);
        return null;
      }

      const bestResult = results.sort((a, b) => a.score - b.score)[0];
      const bestResultPercentage = (1 - bestResult.score) * 100;
      this.state = {
        status: this.constructor.Status.IDLE,
        message: `Found best match for ${home} vs ${away}`,
      };

      if (bestResult.score <= 0.6) {
        console.log(chalk.green(`[Bookmaker] Found confident match - score (${bestResultPercentage.toFixed(2)}%): "${bestResult.item.EventName}" - below threshold.`));
        return bestResult.item;
      }

      console.log(chalk.red(`[Bookmaker] No suitable match found - score (${bestResultPercentage.toFixed(2)}%) - above threshold.`));
      return null;
    } catch (error) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Match search failed: ${error.message}`,
      };
      console.error(`[Bookmaker] Error in getBetKingMatchDataByTeamPair:`, error.message);
      throw error;
    }
  }

  async verifyMatch(timeA, timeB) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: "Verifying match times.",
    };
    if (!timeA || !timeB) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: "Missing date information for verification.",
      };
      console.error("[Bot] Missing date information for verification.");
      return false;
    }

    try {
      const bookmakerDate = new Date(timeA);
      const providerDate = new Date(parseInt(timeB, 10));
      const fiveMinutesInMs = 5 * 60 * 1000;
      const timeDifference = Math.abs(providerDate.getTime() - bookmakerDate.getTime());

      if (timeDifference <= fiveMinutesInMs) {
        // console.log(`[Bookmaker] Time verification successful.`);
        this.state = {
          status: this.constructor.Status.IDLE,
          message: "Time verification successful.",
        };
        return true;
      } else {
        // console.log(`[Bookmaker] Time verification failed. Difference: ${timeDifference / 60000} minutes.`);
        this.state = {
          status: this.constructor.Status.ERROR,
          message: `Time verification failed. Difference: ${timeDifference / 60000} minutes.`,
        };
        return false;
      }
    } catch (error) {
      console.error("[Bot] Error comparing match times:", error);
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Error verifying times: ${error.message}`,
      };
      return false;
    }
  }

  async getMatchDetailsByEvent(eventId, eventName) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: `Fetching details for event: ${eventName}`,
    };

    const eventSlug = this.#slugifyEventName(eventName);
    console.log(`[Bookmaker] Fetching data from page: .../${eventId}/${eventSlug}`);
    console.log(`[Bookmaker] Event ID: ${eventId}`);
    console.log(`[Bookmaker] Event Name: ${eventName}`);
    console.log(`[Bookmaker] Event Slug: ${eventSlug}`);
    const url = `https://m.betking.com/sports/prematch/${eventId}/${eventSlug}`;
    // console.log(`[Bookmaker] Fetching data from page: .../${eventId}/${eventSlug}`);

    let page;
    try {
      page = await this.browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "stylesheet", "font"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setCookie({
        name: "ABTestNewVirtualsLobby",
        value: "false",
        domain: "m.betking.com",
      });

      await page.goto(url, { timeout: 60_000, waitUntil: "domcontentloaded" });

      const remixContentDetails = await page.evaluate(() => {
        if (window.__remixContext) {
          return window.__remixContext;
        } else {
          throw new Error("Could not find __remixContext on the window object.");
        }
      });

      const loaderData = remixContentDetails?.state?.loaderData;
      const matchEventDetails = loaderData["routes/($locale).sports.prematch.$matchId.$eventName.($areaId)._index"]?.event;
      const matchEventId = matchEventDetails?.id;

      if (!matchEventDetails || !matchEventId) {
        console.warn(chalk.yellow("[Bookmaker] Could not find complete event data in Remix context for this match. Skipping."));
        return null;
      }

      if (matchEventId != eventId) {
        throw new Error("Event Id mismatch, Event-Id does not match fetched Match-Details-Event-Id");
      }

      // Fetch additional markets (First Half and Team Totals)
      const areaIds = [1575, 1573]; // 1575: First Half, 1573: Team Totals

      for (const areaId of areaIds) {
        try {
          const typeLabel = areaId === 1575 ? "first half" : (areaId === 1573 ? "team totals" : "additional");
          console.log(`[Bookmaker] Fetching ${typeLabel} markets (areaId: ${areaId}) for event ${eventId}...`);
          const apiUrl = `https://m.betking.com/en-ng/sports/prematch/api/getOddsByAreaId?matchId=${eventId}&areaId=${areaId}`;

          const apiResponse = await page.evaluate(async (url) => {
            const response = await fetch(url);
            if (!response.ok) {
              throw new Error(`API returned ${response.status}`);
            }
            return await response.json();
          }, apiUrl);

          // Merge markets with main event details
          if (apiResponse && apiResponse.markets && Array.isArray(apiResponse.markets)) {
            console.log(`[Bookmaker] Found ${apiResponse.markets.length} ${typeLabel} markets`);

            if (!matchEventDetails.markets) {
              matchEventDetails.markets = [];
            }

            // Merge markets, avoiding duplicates by collectionId
            const existingIds = new Set(matchEventDetails.markets.map(m => m.collectionId));
            const newMarkets = apiResponse.markets.filter(m => !existingIds.has(m.collectionId));

            matchEventDetails.markets = [...matchEventDetails.markets, ...newMarkets];
            console.log(`[Bookmaker] Added ${newMarkets.length} new ${typeLabel} markets. Total markets: ${matchEventDetails.markets.length}`);
          } else {
            console.log(chalk.yellow(`[Bookmaker] No ${typeLabel} markets found in API response (areaId: ${areaId})`));
          }
        } catch (apiError) {
          console.warn(chalk.yellow(`[Bookmaker] Failed to fetch areaId ${areaId} markets: ${apiError.message}.`));
        }
      }

      this.state = {
        status: this.constructor.Status.IDLE,
        message: `Successfully fetched details for event: ${eventName}`,
      };
      return matchEventDetails;
    } catch (error) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Failed to get match details: ${error.message}`,
      };
      console.error(`[Bookmaker] Error extracting Remix JSON on page .../${eventId}/${eventSlug}`, error.message);
      throw error;
    } finally {
      await page.close();
    }
  }

  /**
   * Executes the heavy, page-scraping operation to fetch the complete user account state.
   *
   * This method is the core logic for retrieving all session-dependent data, including
   * the essential  current `balance`, and `freeBets`. It relies on
   * saved cookies for authentication and performs a Puppeteer-based scrape.
   *
   * @private
   * @async
   * @param {string} username - The username used to retrieve the stored cookies.
   * @returns {Promise<Object>} An object containing the fully extracted session data:
   * `{ balance, openBetsCount, freeBets, ... }`.
   * @throws {AuthenticationError} Thrown if saved cookies are missing, invalid, or expired.
   * @throws {Error} Thrown if critical page elements (Astro components) are not found,
   * or if a network/timeout error occurs during navigation/scraping.
   */
  async #getBookmakerAccountState(username) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: `Getting account state for ${username}`,
    };
    let page;
    try {
      page = await this.browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setJavaScriptEnabled(false);

      const cookies = this.botStore.getBookmakerCookies();
      if (!cookies || cookies.length === 0) {
        throw new AuthenticationError("No saved cookies found.");
      }
      if (!(await this.#areCookiesValid(cookies))) {
        throw new AuthenticationError("Cookies have expired.");
      }
      await page.setCookie(...cookies);

      await page.goto("https://m.betking.com", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      // Get props from the Header component for other account details
      const headerPropsString = await page.$eval('astro-island[component-export="Header"]', (island) => island.getAttribute("props"));
      if (!headerPropsString) {
        throw new Error("Could not find Header props.");
      }
      const headerProps = JSON.parse(headerPropsString);
      // Astro serializes some props as [0, value] or [1, value].
      const extractValue = (prop) => (Array.isArray(prop) ? prop[1] : prop);
      const balance = extractValue(headerProps.balance);
      const isAuth = extractValue(headerProps.auth);
      const freeBets = extractValue(headerProps.freeBets);
      const unreadMessageCount = extractValue(headerProps.unreadMessageCount);

      // Get bets count from remix contnent
      const contextContent = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll("script"));
        const contextScript = scripts.find((s) => s.textContent.includes("__remixContext"));
        return contextScript ? contextScript.textContent : null;
      });
      if (!contextContent) throw new Error("Could not find the Remix context script.");
      const jsonString = contextContent.substring(contextContent.indexOf("{"), contextContent.lastIndexOf("}") + 1);
      const remixContext = JSON.parse(jsonString);
      const openBetsCount = remixContext?.state?.loaderData?.root?.betsCount;

      console.log(`[Bookmaker] Successfully extracted account info for ${username}`);

      this.state = {
        status: this.constructor.Status.AUTHENTICATED,
        message: `Successfully extracted account info for ${username}`,
      };

      return {
        balance: parseFloat(balance),
        openBetsCount: parseInt(openBetsCount || 0, 10),
        freeBets: freeBets,
        unreadMessageCount: unreadMessageCount,
        isAuth: isAuth,
      };
    } catch (error) {
      console.error("[Bookmaker] Error in #getAccountState:", error.message);
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Error in getBookmakerAccountState: ${error.message}`,
      };
      throw error;
    } finally {
      if (page) await page.close();
    }
  }

  /**
   * Handles the full user sign-in process, establishing a valid session.
   *
   * This function automates the login via Puppeteer, persists the session cookies,
   * and immediately scrapes the user's account page to retrieve the essential
   * access token and initial account details (balance, free bets).
   *
   * @async
   * @param {string} username - The user's account identifier (e.g., phone number or username).
   * @param {string} password - The user's account password.
   * @returns {Promise<{
   * success: boolean,
   * cookies?: Array<import('puppeteer').Cookie>,
   * session?: Object,
   * error?: string
   * }>} - The result object containing the status, cookies, and session data on success.
   * @throws {Error} Throws if navigation fails, selectors are not found, or login is rejected.
   * @property {Object} this.session - On success, this object is populated with
   * the full user data, including the critical `accessToken` for subsequent API calls.
   */
  async signin(username, password) {
    const maxRetries = 3;
    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      this.state = {
        status: this.constructor.Status.AUTHENTICATING,
        message: `Starting sign-in process (Attempt ${attempt}/${maxRetries}).`,
      };
      const signinData = {
        username: username,
        password: password,
        url: "https://m.betking.com/my-accounts/login?urlAfterLogin=/",
        signedInUrl: "https://m.betking.com/",
      };

      let page;

      try {
        console.log(`[Bookmaker] Sign-in attempt ${attempt} of ${maxRetries}...`);
        page = await this.browser.newPage();
        await page.setRequestInterception(true);
        page.on("request", (req) => {
          const resourceType = req.resourceType();
          if (["image", "stylesheet", "font", "media"].includes(resourceType)) {
            req.abort();
          } else {
            req.continue();
          }
        });

        await page.goto(signinData.url, { waitUntil: "load", timeout: 60_000 });

        const ssDir = path.join(process.cwd(), "data", "screenshots");
        fs.mkdirSync(ssDir, { recursive: true });
        const preStamp = new Date().toISOString().replace(/[:.]/g, "-");
        const prePath = path.join(ssDir, `betking-pre-username-check-${preStamp}.png`);
        await page.screenshot({ path: prePath, fullPage: true });
        // console.log(`[Bookmaker] Screenshot saved (pre-check): ${prePath}`);

        await page.waitForSelector("#username", { timeout: 60_000 }).catch(async () => {
          const failStamp = new Date().toISOString().replace(/[:.]/g, "-");
          const failPath = path.join(ssDir, `betking-username-not-found-${failStamp}.png`);
          await page.screenshot({ path: failPath, fullPage: true });
          console.log(`[Bookmaker] Screenshot saved (failure): ${failPath}`);
          throw new Error("Username field not found. Verify selector.");
        });
        await page.type("#username", signinData.username);

        const postStamp = new Date().toISOString().replace(/[:.]/g, "-");
        const postPath = path.join(ssDir, `betking-post-username-check-${postStamp}.png`);
        await page.screenshot({ path: postPath, fullPage: true });
        // console.log(`[Bookmaker] Screenshot saved (post-check): ${postPath}`);

        await page.waitForSelector("#password", { timeout: 60_000 }).catch(() => {
          throw new Error("Password field not found. Verify selector.");
        });
        await page.type("#password", signinData.password);

        await page.keyboard.press("Enter");

        await page.waitForNavigation({ waitUntil: "load", timeout: 60_000 });
        if (page.url().startsWith(signinData.signedInUrl)) {
          console.log(`[Bookmaker] Logged in ${username}`);
        } else {
          throw new Error(`Login failed. Expected to be at ${signinData.signedInUrl} but ended up at ${page.url()}`);
        }

        // Get cookies
        const cookies = await page.cookies();
        if (!cookies) {
          throw new Error("Cookies could not be found after login.");
        }

        console.log(`[Bookmaker] Cookies found for ${username}`);
        await this.botStore.setBookmakerCookies(cookies);

        const accessTokenCookie = cookies.find((c) => c.name === "accessToken");
        let accessToken = accessTokenCookie ? accessTokenCookie.value : null;

        // Fallback: If no cookie found, try to extract from page storage
        if (!accessToken) {
          console.log(`[Bookmaker] accessToken cookie not found. Attempting extraction from page storage...`);
          accessToken = await page.evaluate(() => {
            // 1. Try common localStorage/sessionStorage keys
            const tokenKeys = ["accessToken", "token", "userToken", "phx-token", "auth-token", "jwt", "session"];
            for (const key of tokenKeys) {
              const val = localStorage.getItem(key) || sessionStorage.getItem(key);
              if (val && typeof val === "string" && val.length > 20) return val;

              // Try parsing as JSON
              try {
                const parsed = JSON.parse(val);
                if (parsed && typeof parsed === "object") {
                  if (parsed.token && typeof parsed.token === "string") return parsed.token;
                  if (parsed.accessToken && typeof parsed.accessToken === "string") return parsed.accessToken;
                }
              } catch (e) { }
            }

            // 2. Try to find in any JSON object in localStorage
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              try {
                const val = JSON.parse(localStorage.getItem(key));
                if (val && typeof val === "object") {
                  if (val.token && typeof val.token === "string" && val.token.length > 20) return val.token;
                  if (val.accessToken && typeof val.accessToken === "string" && val.accessToken.length > 20) return val.accessToken;
                }
              } catch (e) { }
            }

            // 3. Try Remix context
            if (window.__remixContext && window.__remixContext.state && window.__remixContext.state.loaderData) {
              const loaderData = window.__remixContext.state.loaderData;
              const findToken = (obj, depth = 0) => {
                if (!obj || typeof obj !== "object" || depth > 5) return null;
                for (const k in obj) {
                  if (typeof obj[k] === "string" && obj[k].length > 20 && (k.toLowerCase().includes("token") || k.toLowerCase().includes("auth"))) {
                    return obj[k];
                  }
                  const found = findToken(obj[k], depth + 1);
                  if (found) return found;
                }
                return null;
              };
              return findToken(loaderData);
            }

            return null;
          });
        }

        // Get access token from cookies
        if (!accessToken) {
          throw new Error("Access token could not be found after login (checked cookies and storage).");
        }
        console.log(`[Bookmaker] Successfully extracted access token (Length: ${accessToken.length})`);
        await this.botStore.setAccessToken(accessToken);
        await page.close();

        // Get accunt state
        const accountState = await this.#getBookmakerAccountState(username);
        await this.botStore.setBookmakerSession(accountState);

        this.state = {
          status: this.constructor.Status.AUTHENTICATED,
          message: "Sign-in successful.",
        };
        return {
          success: true,
          cookies: cookies,
          accessToken,
        };
      } catch (error) {
        lastError = error;
        console.error(`[Bookmaker] Sign-in attempt ${attempt} failed: ${error.message}`);

        // Ensure page is closed before next attempt
        if (page && !page.isClosed()) {
          try {
            await page.close();
          } catch (closeErr) {
            console.error("[Bookmaker] Error closing page during retry cleanup:", closeErr.message);
          }
        }

        if (attempt < maxRetries) {
          console.log(`[Bookmaker] Retrying sign-in in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }
    }

    // If we exit the loop, all retries failed
    this.state = {
      status: this.constructor.Status.UNAUTHENTICATED,
      message: lastError ? lastError.message : "Checking failed after retries",
    };
    return { success: false, error: lastError ? lastError.message : "Unknown error after retries" };
  }

  /**
   * Retrieves the live, current account details for the authenticated user.
   *
   * This function is designed to **always** run a new scraping operation via
   * `#getBookmakerAccountState` to ensure the most up-to-date information,
   * particularly the current balance and free bet status. It overwrites the
   * existing `this.session` data with the fresh results.
   *
   * @async
   * @param {string} username - The username associated with the active session (used for logging and cookie retrieval).
   * @returns {Promise<Object>} The full, fresh user session data object (e.g., { balance, openBetsCount, accessToken, ... }).
   * @throws {AuthenticationError} Thrown if cookies are missing or expired, requiring a new sign-in.
   * @throws {Error} Thrown for any general scraping or network errors.
   * @property {Object} this.session - The retrieved fresh session data is stored here, updating the `accessToken` and all account details.
   */
  async getAccountInfo(username) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: "Refreshing account info.",
    };
    try {
      const accountInfo = await this.#getBookmakerAccountState(username);
      console.log(`[Bookmaker] Refreshed and cached account info for ${username}.`);
      this.state = {
        status: this.constructor.Status.AUTHENTICATED,
        message: "Session is active.",
      };
      return accountInfo;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        this.state = {
          status: this.constructor.Status.UNAUTHENTICATED,
          message: error.message,
        };
      } else {
        this.state = {
          status: this.constructor.Status.ERROR,
          message: error.message,
        };
      }
      console.error(`[Bookmaker] Error getting account info:`, error.message);
      throw error;
    }
  }

  /**
   * Fetch the FootballGO live overview payload and return parsed JSON.
   * Uses the current authenticated session cookies to make the request from within the page context.
   */
  async fetchFootballGoOverview() {
    let page;
    try {
      const cookies = this.botStore.getBookmakerCookies();
      if (!cookies || cookies.length === 0) {
        throw new AuthenticationError("No saved cookies found.");
      }
      // Validate cookies quickly; if invalid, propagate auth error
      if (!(await this.#areCookiesValid(cookies))) {
        throw new AuthenticationError("Cookies have expired.");
      }

      page = await this.browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        const rt = req.resourceType();
        if (["image", "stylesheet", "font", "media"].includes(rt)) {
          req.abort();
        } else {
          req.continue();
        }
      });
      await page.setCookie(...cookies);

      // Land on domain to ensure cookie scope, then request overview
      await page.goto("https://m.betking.com/", {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });

      const overviewUrl =
        "https://m.betking.com/sports/live/api/overview/8?includeTranslations=false&_data=routes%2F%28%24locale%29.sports.live.api.overview.%24sportId";

      const result = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url, {
            method: "GET",
            headers: {
              Accept: "application/json",
              Referer: "https://m.betking.com/sports/live/football",
            },
          });
          const text = await res.text();
          if (!res.ok) {
            return { error: true, status: res.status, text };
          }
          try {
            return { error: false, data: JSON.parse(text) };
          } catch (e) {
            return { error: true, status: 200, text: `Failed JSON parse: ${text}` };
          }
        } catch (err) {
          return { error: true, status: 0, text: err.message };
        }
      }, overviewUrl);

      if (result.error) {
        throw new Error(
          `Overview request failed (status ${result.status}): ${result.text}`,
        );
      }
      return result.data;
    } catch (error) {
      console.error("[Bookmaker] fetchFootballGoOverview error:", error.message);
      throw error;
    } finally {
      if (page) await page.close();
    }
  }

  /**
   * From FootballGO overview, pick all selections with odds <= maxOdd,
   * find the minimum odd among them, then randomly select one from those minimums.
   * Returns the tuple { event, market, selection } for payload assembly.
   */
  async selectRandomLowestOddFromOverview(maxOdd = 1.2) {
    const data = await this.fetchFootballGoOverview();
    const sportBlocks = Array.isArray(data?.sportData) ? data.sportData : [];
    // Prefer the FootballGO block (id:8 or name:"FootballGO")
    const footballGo = sportBlocks.find(
      (s) => s?.id === 8 || String(s?.name).toLowerCase().includes("footballgo"),
    );
    if (!footballGo) {
      throw new Error("FootballGO overview block not found");
    }

    const candidates = [];
    for (const tournament of footballGo.tournaments || []) {
      for (const event of tournament.events || []) {
        for (const market of event.markets || []) {
          for (const selection of market.selections || []) {
            const oddVal = selection?.odd?.value;
            if (typeof oddVal === "number" && oddVal <= maxOdd) {
              candidates.push({ event, market, selection, oddValue: oddVal });
            }
          }
        }
      }
    }

    if (candidates.length === 0) {
      return null; // No low-odd candidates found
    }

    const minOdd = candidates.reduce(
      (acc, c) => (c.oddValue < acc ? c.oddValue : acc),
      candidates[0].oddValue,
    );
    const minGroup = candidates.filter((c) => c.oddValue === minOdd);
    const choice = minGroup[Math.floor(Math.random() * minGroup.length)];
    return choice;
  }

  /**
   * Return up to `limit` random FootballGO low-odds candidates (odd <= maxOdd).
   * Each candidate is an object: { event, market, selection, oddValue }.
   */
  async selectLowOddsCandidatesFromOverview(maxOdd = 1.2, limit = 3) {
    const data = await this.fetchFootballGoOverview();
    const sportBlocks = Array.isArray(data?.sportData) ? data.sportData : [];
    const footballGo = sportBlocks.find(
      (s) => s?.id === 8 || String(s?.name).toLowerCase().includes("footballgo"),
    );
    if (!footballGo) {
      throw new Error("FootballGO overview block not found");
    }

    const candidates = [];
    for (const tournament of footballGo.tournaments || []) {
      for (const event of tournament.events || []) {
        for (const market of event.markets || []) {
          for (const selection of market.selections || []) {
            const oddVal = selection?.odd?.value;
            if (typeof oddVal === "number" && oddVal <= maxOdd) {
              candidates.push({ event, market, selection, oddValue: oddVal });
            }
          }
        }
      }
    }

    if (candidates.length === 0) {
      return [];
    }

    // Shuffle candidates to ensure randomness, then take up to `limit`
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    // Ensure uniqueness by event id to avoid duplicates on same match
    const uniqueByEvent = [];
    const seenEventIds = new Set();
    for (const c of candidates) {
      const id = c?.event?.id;
      if (!seenEventIds.has(id)) {
        uniqueByEvent.push(c);
        seenEventIds.add(id);
      }
      if (uniqueByEvent.length >= limit) break;
    }

    return uniqueByEvent;
  }

  /**
   * Convert overview event/market/selection into oddsSelection for betslip payload.
   */
  buildOddsSelectionFromOverview(event, market, selection) {
    return {
      IDSelectionType: selection.typeId,
      IDSport: event.sportId,
      allowFixed: false,
      compatibilityLevel: 0,
      eventCategory: event.eventCategory,
      eventDate: event.date,
      eventId: event.categoryId,
      eventName: event.categoryName,
      fixed: false,
      gamePlay: 1,
      incompatibleEvents: Array.isArray(event.incompatibleEvents)
        ? event.incompatibleEvents
        : [],
      isExpired: false,
      isLocked: false,
      isBetBuilder: false,
      marketId: market.id,
      marketName: market.name,
      marketTag: 0,
      marketTypeId: market.typeId,
      matchId: event.id,
      matchName: event.name,
      oddValue: selection.odd.value,
      parentEventId: event.id,
      selectionId: selection.id,
      selectionName: selection.name,
      selectionNoWinValues: [],
      smartCode: event.smartCode ?? 0,
      specialValue:
        (market.specialBetValue !== undefined && market.specialBetValue !== null)
          ? String(market.specialBetValue)
          : "0",
      sportName: event.sportName,
      tournamentId: event.tournamentId,
      tournamentName: event.tournamentName,
    };
  }

  /**
   * Build a multi-slip payload combining the primary bookmaker selection and a
   * randomly chosen lowest-odd FootballGO selection (<= maxLowOdd).
   * If no FootballGO low-odd selection is found, falls back to single-slip payload.
   */
  async constructMultiSlipPayloadWithLowOdd(
    matchData,
    market,
    selection,
    stakeAmount,
    providerData,
    maxLowOdd = 1.2,
    lowOddChoiceParam = null,
  ) {
    try {
      // Build primary odds selection from detailed bookmaker data
      // const eventCategory = this.sportIdMapper[providerData.sportId] || "F";
      const eventCategory = "F";
      const primaryOddsSelection = {
        IDSelectionType: selection.typeId,
        IDSport: matchData.sportId,
        allowFixed: false,
        compatibilityLevel: 0,
        eventCategory: eventCategory,
        eventDate: matchData.date,
        eventId: matchData.id,
        eventName: matchData.categoryName,
        fixed: false,
        gamePlay: 1,
        incompatibleEvents: [],
        isExpired: false,
        isLocked: false,
        isBetBuilder: false,
        marketId: market.id,
        marketName: market.name,
        marketTag: 0,
        marketTypeId: market.typeId,
        matchId: matchData.id,
        matchName: matchData.name,
        oddValue: selection.odd.value,
        parentEventId: matchData.id,
        selectionId: selection.id,
        selectionName: selection.name,
        selectionNoWinValues: [],
        smartCode: matchData.smartBetCode,
        specialValue: selection.specialValue || "0",
        sportName: matchData.sportName,
        tournamentId: matchData.tournamentId,
        tournamentName: matchData.tournamentName,
      };

      // Try get FootballGO low-odd selection (prefer provided candidate)
      const lowOddChoice =
        lowOddChoiceParam || (await this.selectRandomLowestOddFromOverview(maxLowOdd));
      console.log("lowOddChoice", lowOddChoice);
      if (!lowOddChoice) {
        // Fallback to single-slip behavior
        return this.constructBetPayload(
          matchData,
          market,
          selection,
          stakeAmount,
          providerData,
        );
      }

      const addOddsSelection = this.buildOddsSelectionFromOverview(
        lowOddChoice.event,
        lowOddChoice.market,
        lowOddChoice.selection,
      );

      const selections = [primaryOddsSelection, addOddsSelection];
      const oddValues = selections.map((s) => Number(s.oddValue) || 0);
      const totalOdds = oddValues.reduce((acc, v) => acc * v, 1);
      const potentialWinnings = stakeAmount * totalOdds;
      const minOdd = Math.min(...oddValues);
      const maxOdd = Math.max(...oddValues);

      const grouping = {
        grouping: 2,
        combinations: 1,
        minWin: potentialWinnings,
        minWinNet: potentialWinnings,
        netStakeMinWin: potentialWinnings,
        maxWin: potentialWinnings,
        maxWinNet: potentialWinnings,
        netStakeMaxWin: potentialWinnings,
        minBonus: 0,
        maxBonus: 0,
        minPercentageBonus: 0,
        maxPercentageBonus: 0,
        stake: stakeAmount,
        netStake: stakeAmount,
        selected: true,
      };

      const betCoupon = {
        isClientSideCoupon: true,
        couponTypeId: 2,
        minWin: potentialWinnings,
        minWinNet: potentialWinnings,
        netStakeMinWin: potentialWinnings,
        maxWin: potentialWinnings,
        maxWinNet: potentialWinnings,
        netStakeMaxWin: potentialWinnings,
        minBonus: 0,
        maxBonus: 0,
        minPercentageBonus: 0,
        maxPercentageBonus: 0,
        minOdd: minOdd,
        maxOdd: maxOdd,
        totalOdds: totalOdds,
        stake: stakeAmount,
        useGroupsStake: false,
        stakeGross: stakeAmount,
        stakeTaxed: 0,
        taxPercentage: 0,
        tax: 0,
        minWithholdingTax: 0,
        maxWithholdingTax: 0,
        turnoverTax: 0,
        totalCombinations: 1,
        odds: selections,
        groupings: [grouping],
        possibleMissingGroupings: [
          { combinations: 2, grouping: 1 },
        ],
        currencyId: 16,
        isLive: true,
        isVirtual: false,
        currentEvalMotivation: 0,
        betCouponGlobalVariable: {
          currencyId: 16,
          defaultStakeGross: 100,
          isFreeBetRedemptionEnabled: false,
          isVirtualsInstallation: false,
          maxBetStake: 175438596.49,
          maxCombinationBetWin: 75000000,
          maxCombinationsByGrouping: 10000,
          maxCouponCombinations: 17543859,
          maxGroupingsBetStake: 41641682,
          maxMultipleBetWin: 75000000,
          maxNoOfEvents: 40,
          maxNoOfSelections: 40,
          maxSingleBetWin: 75000000,
          minBetStake: 10,
          minBonusOdd: 1.35,
          minFlexiCutOdds: 1.01,
          minFlexiCutSelections: 5,
          minGroupingsBetStake: 5,
          stakeInnerMod0Combination: 0.01,
          stakeMod0Multiple: 0,
          stakeMod0Single: 0,
          stakeThresholdMultiple: 175438.6,
          stakeThresholdSingle: 17543.86,
          flexiCutGlobalVariable: {
            parameters: {
              formulaId: 1,
              minOddThreshold: 1.05,
              minWinningSelections: 2,
            },
          },
        },
        language: "en",
        hasLive: true,
        couponType: 2,
        allGroupings: [grouping],
      };

      return {
        betCoupon,
        allowOddChanges: true,
        allowStakeReduction: false,
        requestTransactionId: Date.now().toString(),
        transferStakeFromAgent: false,
      };
    } catch (error) {
      console.error(
        "[Bookmaker] constructMultiSlipPayloadWithLowOdd error:",
        error.message,
      );
      throw error;
    }
  }

  /**
   * Places a bet using a direct API call, leveraging the cached `accessToken`
   * from the active session.
   *
   * This function avoids unnecessary scraping by prioritizing the `accessToken`
   * stored in `this.session`. It is designed for speed and efficiency, assuming
   * a valid session has already been established and its cookies are present.
   *
   * @async
   * @param {string} username - The username (used to load associated cookies).
   * @param {Object} data - The betting payload data to be sent to the bookmaker's API.
   * @returns {Promise<Object>} The API response object from the bet placement, indicating success or failure details.
   * @throws {AuthenticationError} Thrown if:
   * 1. Cookies are missing or expired (leading to session invalidation).
   * 2. The required `accessToken` is missing from `this.session`.
   * @throws {Error} Thrown if the API call fails, the response indicates a rejection, or a network/puppeteer error occurs.
   */
  async placeBet(username, data) {
    this.state = {
      status: this.constructor.Status.WORKING,
      message: "Starting bet placement.",
    };
    let page;

    try {
      console.log("[Bookmaker] Starting place bet process for", username);

      const cookies = this.botStore.getBookmakerCookies();
      if (!cookies.length) {
        throw new AuthenticationError("No cookies found.");
      }
      if (!(await this.#areCookiesValid(cookies))) {
        throw new AuthenticationError("Cookies are expired.");
      }

      const accessToken = this.botStore.getAccessToken();
      if (!accessToken) {
        throw new AuthenticationError("Access token is missing. Please sign in or refresh account info.");
      }

      page = await this.browser.newPage();
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["image", "stylesheet", "font", "media"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setCookie(...cookies);

      // console.log('[Bookmaker] Navigating to betslip page to acquire session data...');
      await page.goto("https://m.betking.com/sports/betslip", {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });

      if (data?.betCoupon?.couponTypeId === 2 || data?.betCoupon?.couponType === 2) {
        console.log("[Bookmaker] Multiple bet payload:", JSON.stringify(data));
      }
      const result = await page.evaluate(
        async (dataToPost, token) => {
          const apiUrl = "https://m.betking.com/sports/action/placebet?_data=routes%2F%28%24locale%29.sports.action.placebet";
          const bodyPayload = new URLSearchParams();
          bodyPayload.append("data", JSON.stringify(dataToPost));

          const headers = {
            "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
            Referer: "https://m.betking.com/sports/betslip",
            Authorization: `Bearer ${token}`,
          };

          const response = await fetch(apiUrl, {
            method: "PUT",
            headers: headers,
            body: bodyPayload,
          });

          const responseText = await response.text();

          if (!response.ok) {
            return { error: true, status: response.status, text: responseText };
          }
          if (!responseText) {
            return {
              error: true,
              status: 200,
              text: "Server returned an empty successful response.",
            };
          }
          try {
            return JSON.parse(responseText);
          } catch (e) {
            return {
              error: true,
              status: 200,
              text: `Failed to parse JSON: ${responseText}`,
            };
          }
        },
        data,
        accessToken,
      );

      if (result.error) {
        throw new Error(`Bet placement failed with status ${result.status}: ${result.text}`);
      }

      const errorMessages = {
        0: "An error has occurred, please try again",
        2: "At this time you cannot place bets. Please contact customer support for more information",
        3: "One of the chosen events has expired",
        4: "One of the odds has changed",
        16: "Your account balance is low. Deposit now in order to proceed with your bet",
        49: "Maximum combinability exceeded",
        52: "Maximum stake allowed exceeded",
        53: "Maximum winning allowed exceeded",
        54: "Stake is lower than amount allowed",
        55: "Stake for each group is lower than amount allowed",
        69: "The maximum number of events allowed has been exceeded",
        70: "Incompatible events in the coupon",
        406: "Free Bet is not available",
        407: "Free Bet has already been used",
        412: "Free Bet has expired",
        415: "Free Bet is not available",
      };

      console.log("[Bookmaker] Raw API Response:", JSON.stringify(result, null, 2));

      const errorMessage = errorMessages[result.responseStatus];
      if (errorMessage) {
        throw new Error(`Bet was rejected by the server: ${errorMessage} (Status: ${result.responseStatus})`);
      } else if (result.responseStatus !== 1) {
        // Assuming 1 is the success status code
        const fallbackMessage = result.errorsList ? JSON.stringify(result.errorsList) : "Unknown reason";
        throw new Error(`Bet was rejected by the server. Status: ${result.responseStatus}, Errors: ${fallbackMessage}`);
      }

      console.log("[Bookmaker] Bet placed successfully:", result);
      this.state = {
        status: this.constructor.Status.SUCCESS,
        message: "Bet placed successfully.",
      };
      return result;
    } catch (error) {
      this.state = {
        status: this.constructor.Status.ERROR,
        message: `Bet placement failed: ${error.message}`,
      };
      if (error instanceof AuthenticationError) {
        this.state = {
          status: this.constructor.Status.UNAUTHENTICATED,
          message: `Bet failed due to authentication issue: ${error.message}`,
        };
        throw error;
      }
      console.error("[Bookmaker] Error in placeBet:", error.message);
      if (page) {
        // await page.screenshot({ path: `placebet_error_${Date.now()}.png` });
      }
      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  async getLiveBalance() {
    this.state = { status: this.constructor.Status.WORKING, message: "Getting live balance via browser-API." };
    const url = "https://m.betking.com/api/account/v1/users/me/wallet";

    try {
      const rawResponse = await this.#fetchJsonFromApi(url);

      if (!rawResponse) {
        console.error("[Bookmaker] #fetchJsonFromApi returned null/undefined for wallet API.");
        throw new AuthenticationError("Failed to retrieve balance (Technical/Network Error).");
      }

      console.log(chalk.yellow(`[Bookmaker] Raw Wallet API Response:`), JSON.stringify(rawResponse, null, 2));

      if (rawResponse.error) {
        if (rawResponse.error.code === 401 || rawResponse.error.code === 403) {
          throw new AuthenticationError(`Authorization denied from API response (Code: ${rawResponse.error.code}).`);
        }
        throw new Error(`API returned error: ${rawResponse.error.message}`);
      }

      const mainWallet = rawResponse.data;

      if (!mainWallet) {
        console.error(`[Bookmaker] Failed Format Check: Could not find 'data' object or 'balance' property.`);
        throw new Error("Wallet API did not return expected data format.");
      }

      this.state = { status: this.constructor.Status.IDLE, message: "Live balance fetched." };
      return mainWallet.balance;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      // Wrap all other failures to guarantee authentication retry.
      throw new AuthenticationError(`Balance check failed: ${error.message}`);
    }
  }

  constructBetPayload(matchData, market, selection, stakeAmount, providerData) {
    const totalOdds = selection.odd.value;
    const potentialWinnings = stakeAmount * totalOdds;
    const eventCategory = this.sportIdMapper[providerData.sportId] || "F";

    const oddsSelection = {
      IDSelectionType: selection.typeId,
      IDSport: matchData.sportId,
      allowFixed: false,
      compatibilityLevel: 0,
      eventCategory: eventCategory,
      eventDate: matchData.date,
      eventId: matchData.id,
      eventName: matchData.categoryName,
      fixed: false,
      gamePlay: 1,
      incompatibleEvents: [],
      isExpired: false,
      isLocked: false,
      isBetBuilder: false,
      marketId: market.id,
      marketName: market.name,
      marketTag: 0,
      marketTypeId: market.typeId,
      matchId: matchData.id,
      matchName: matchData.name,
      oddValue: selection.odd.value,
      parentEventId: matchData.id,
      selectionId: selection.id,
      selectionName: selection.name,
      selectionNoWinValues: [],
      smartCode: matchData.smartBetCode,
      specialValue: selection.specialValue || "0",
      sportName: matchData.sportName,
      tournamentId: matchData.tournamentId,
      tournamentName: matchData.tournamentName,
    };

    const grouping = {
      grouping: 1,
      combinations: 1,
      minWin: potentialWinnings,
      minWinNet: potentialWinnings,
      netStakeMinWin: potentialWinnings,
      maxWin: potentialWinnings,
      maxWinNet: potentialWinnings,
      netStakeMaxWin: potentialWinnings,
      minBonus: 0,
      maxBonus: 0,
      minPercentageBonus: 0,
      maxPercentageBonus: 0,
      stake: stakeAmount,
      netStake: stakeAmount,
      selected: true,
    };

    const betCoupon = {
      isClientSideCoupon: true,
      couponTypeId: 1,
      minWin: potentialWinnings,
      minWinNet: potentialWinnings,
      netStakeMinWin: potentialWinnings,
      maxWin: potentialWinnings,
      maxWinNet: potentialWinnings,
      netStakeMaxWin: potentialWinnings,
      minBonus: 0,
      maxBonus: 0,
      minPercentageBonus: 0,
      maxPercentageBonus: 0,
      minOdd: totalOdds,
      maxOdd: totalOdds,
      totalOdds: totalOdds,
      stake: stakeAmount,
      useGroupsStake: false,
      stakeGross: stakeAmount,
      stakeTaxed: 0,
      taxPercentage: 0,
      tax: 0,
      minWithholdingTax: 0,
      maxWithholdingTax: 0,
      turnoverTax: 0,
      totalCombinations: 1,
      odds: [oddsSelection],
      groupings: [grouping],
      allGroupings: [grouping],
      possibleMissingGroupings: [],
      currencyId: 16,
      isLive: false,
      isVirtual: false,
      currentEvalMotivation: 0,
      betCouponGlobalVariable: {
        currencyId: 16,
        defaultStakeGross: 100,
        isFreeBetRedemptionEnabled: false,
        isVirtualsInstallation: false,
        maxBetStake: 175438596.49,
        maxCombinationBetWin: 75000000,
        maxCombinationsByGrouping: 10000,
        maxCouponCombinations: 17543859,
        maxGroupingsBetStake: 41641682,
        maxMultipleBetWin: 75000000,
        maxNoOfEvents: 40,
        maxNoOfSelections: 40,
        maxSingleBetWin: 75000000,
        minBetStake: 10,
        minBonusOdd: 1.35,
        minFlexiCutOdds: 1.01,
        minFlexiCutSelections: 5,
        minGroupingsBetStake: 5,
        stakeInnerMod0Combination: 0.01,
        stakeMod0Multiple: 0,
        stakeMod0Single: 0,
        stakeThresholdMultiple: 175438.6,
        stakeThresholdSingle: 17543.86,
        flexiCutGlobalVariable: {
          parameters: {
            formulaId: 1,
            minOddThreshold: 1.05,
            minWinningSelections: 2,
          },
        },
      },
      language: "en",
      hasLive: false,
      couponType: 1,
    };

    return {
      betCoupon,
      allowOddChanges: true,
      allowStakeReduction: false,
      requestTransactionId: Date.now().toString(),
      transferStakeFromAgent: false,
    };
  }
}

export default BetKingBookmaker;
