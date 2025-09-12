import { test, mock, before, beforeEach, after } from "node:test";
import EdgeRunner from "../../../src/bots/edgerunner/index.js";

const consoleLogSpy = [];
const originalConsoleLog = console.log;
console.log = (...args) => {
	consoleLogSpy.push(args.join(" "));
	originalConsoleLog(...args);
};

const providerFootballMarket = {
	"money_line": {
		"home": 3.49,
		"draw": 4.46,
		"away": 1.662
	},
	"spreads": {
		"-3.5": { "hdp": -3.5, "home": 4.50, "away": 1.15 },
		"-2.5": { "hdp": -2.5, "home": 3.20, "away": 1.30 },
		"-1.5": { "hdp": -1.5, "home": 2.30, "away": 1.55 },
		"0.0": { "hdp": 0.0, "home": 1.62, "away": 2.15 },
		"0.5": { "hdp": 0.5, "home": 1.48, "away": 2.50 },
		"1.5": { "hdp": 1.5, "home": 1.26, "away": 3.50 },
		"2.5": { "hdp": 2.5, "home": 1.12, "away": 5.00 },
		"3.5": { "hdp": 3.5, "home": 1.02, "away": 7.00 }
	},
	"totals": {
		"3.75": {
			"points": 3.75,
			"alt_line_id": null,
			"over": 1.781,
			"under": 1.952,
			"max": 225
		},
		"3.0": {
			"points": 3,
			"alt_line_id": 50430841100,
			"over": 1.326,
			"under": 2.95,
			"max": 225
		},
		"3.25": {
			"points": 3.25,
			"alt_line_id": 50430841101,
			"over": 1.476,
			"under": 2.42,
			"max": 225
		},
		"3.5": {
			"points": 3.5,
			"alt_line_id": 50430841102,
			"over": 1.636,
			"under": 2.12,
			"max": 225
		},
		"4.0": {
			"points": 4,
			"alt_line_id": 50430841103,
			"over": 1.97,
			"under": 1.735,
			"max": 225
		},
		"4.25": {
			"points": 4.25,
			"alt_line_id": 50430841104,
			"over": 2.17,
			"under": 1.584,
			"max": 225
		},
		"4.5": {
			"points": 4.5,
			"alt_line_id": 50430841105,
			"over": 2.38,
			"under": 1.49,
			"max": 225
		}
	},
	"team_total": {
		"home": {
			"points": 1.5,
			"over": 2.04,
			"under": 1.689
		},
		"away": {
			"points": 2.5,
			"over": 2.08,
			"under": 1.666
		}
	},
	"sportId": "1",
	"periodNumber": 0
}

const bookmakerFootballMarket = [
	{
		"collectionId": 463669636,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1",
				"typeId": 4,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 3.45,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044345,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669636
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "X",
				"typeId": 2,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 4.25,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044346,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669636
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "2",
				"typeId": 5,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.74,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044347,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669636
			}
		],
		"name": "1X2",
		"typeId": 110,
		"specialValue": "0",
		"oddsDescription": "Standard 1X2: Predict the final outcome of the match in regular time. The bet offers three possible outcomes: 1 (home team wins); X (teams draw), 2 (away team wins)\r\n Fantasy 1X2: Predict which team/player will score most goals in their respective matches. If both teams/players score the same number of goals, the winning selection will be X. Both players must start the match. If either or both players do not start Goalscorer bets will be void. Extra-Time and Penalty shoot-out goals do not count.",
	},
	{
		"collectionId": 461713992,
		"selections": [
			{
				"specialValue": "0 : 3",
				"specialValueNumber": -3,
				"specialValueString": "0 : 3",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 30,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932001,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713992
			},
			{
				"specialValue": "0 : 3",
				"specialValueNumber": -3,
				"specialValueString": "0 : 3",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 11,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932005,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713992
			},
			{
				"specialValue": "0 : 3",
				"specialValueNumber": -3,
				"specialValueString": "0 : 3",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.004,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932031,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713992
			}
		],
		"name": "Handicap -3",
		"typeId": 342,
		"specialValue": "0 : 3",
	},
	{
		"collectionId": 461713996,
		"selections": [
			{
				"specialValue": "0 : 2",
				"specialValueNumber": -2,
				"specialValueString": "0 : 2",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 20,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932002,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713996
			},
			{
				"specialValue": "0 : 2",
				"specialValueNumber": -2,
				"specialValueString": "0 : 2",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 9.4,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932008,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713996
			},
			{
				"specialValue": "0 : 2",
				"specialValueNumber": -2,
				"specialValueString": "0 : 2",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.04,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932028,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713996
			}
		],
		"name": "Handicap -2",
		"typeId": 342,
		"specialValue": "0 : 2",
	},
	{
		"collectionId": 461713997,
		"selections": [
			{
				"specialValue": "0 : 1",
				"specialValueNumber": -1,
				"specialValueString": "0 : 1",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 9.8,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932004,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713997
			},
			{
				"specialValue": "0 : 1",
				"specialValueNumber": -1,
				"specialValueString": "0 : 1",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 6.2,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932007,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713997
			},
			{
				"specialValue": "0 : 1",
				"specialValueNumber": -1,
				"specialValueString": "0 : 1",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.17,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932014,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713997
			}
		],
		"name": "Handicap -1",
		"typeId": 342,
		"specialValue": "0 : 1",
	},
	{
		"collectionId": 461713988,
		"selections": [
			{
				"specialValue": "1 : 0",
				"specialValueNumber": 1,
				"specialValueString": "1 : 0",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 2.27,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932000,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713988
			},
			{
				"specialValue": "1 : 0",
				"specialValueNumber": 1,
				"specialValueString": "1 : 0",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 3.95,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932006,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713988
			},
			{
				"specialValue": "1 : 0",
				"specialValueNumber": 1,
				"specialValueString": "1 : 0",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 2.34,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932030,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713988
			}
		],
		"name": "Handicap 1",
		"typeId": 342,
		"specialValue": "1 : 0",
	},
	{
		"collectionId": 461714000,
		"selections": [
			{
				"specialValue": "2 : 0",
				"specialValueNumber": 2,
				"specialValueString": "2 : 0",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.5,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932009,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461714000
			},
			{
				"specialValue": "2 : 0",
				"specialValueNumber": 2,
				"specialValueString": "2 : 0",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 4.65,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932013,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461714000
			},
			{
				"specialValue": "2 : 0",
				"specialValueNumber": 2,
				"specialValueString": "2 : 0",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 4.15,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932027,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461714000
			}
		],
		"name": "Handicap 2",
		"typeId": 342,
		"specialValue": "2 : 0",
	},
	{
		"collectionId": 461713998,
		"selections": [
			{
				"specialValue": "3 : 0",
				"specialValueNumber": 3,
				"specialValueString": "3 : 0",
				"name": "Home",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.18,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932010,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713998
			},
			{
				"specialValue": "3 : 0",
				"specialValueNumber": 3,
				"specialValueString": "3 : 0",
				"name": "Draw",
				"typeId": 1712,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 6.6,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932024,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713998
			},
			{
				"specialValue": "3 : 0",
				"specialValueNumber": 3,
				"specialValueString": "3 : 0",
				"name": "Away",
				"typeId": 1715,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 8.2,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1515932040,
				"smartCode": 23115,
				"status": "VALID",
				"oddCollectionID": 461713998
			}
		],
		"name": "Handicap 3",
		"typeId": 342,
		"specialValue": "3 : 0",
	},
	{
		"collectionId": 463669624,
		"selections": [
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "Over",
				"typeId": 12,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.27,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044312,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669624
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "Under",
				"typeId": 13,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 3,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044313,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669624
			}
		],
		"name": "Total Goals",
		"typeId": 160,
		"specialValue": "2.5",
		"oddsDescription": "Predict whether the number of goals scored in a match will be under/over the value specified.",
		"id": 463669624,
		"spreadMarkets": [
			{
				"collectionId": 463669624,
				"selections": [
					{
						"specialValue": "2.5",
						"specialValueNumber": 2.5,
						"specialValueString": "2.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 1.27,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044312,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669624
					},
					{
						"specialValue": "2.5",
						"specialValueNumber": 2.5,
						"specialValueString": "2.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 3,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044313,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669624
					}
				],
				"name": "Total Goals 2.5",
				"typeId": 160,
				"specialValue": "2.5",
				"oddsDescription": "Predict whether the number of goals scored in a match will be under/over the value specified.",
			},
			{
				"collectionId": 463669625,
				"selections": [
					{
						"specialValue": "3.5",
						"specialValueNumber": 3.5,
						"specialValueString": "3.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 1.69,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044314,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669625
					},
					{
						"specialValue": "3.5",
						"specialValueNumber": 3.5,
						"specialValueString": "3.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 1.89,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044315,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669625
					}
				],
				"name": "Total Goals 3.5",
				"typeId": 160,
				"specialValue": "3.5",
				"oddsDescription": "Predict whether the number of goals scored in a match will be under/over the value specified.",
			},
			{
				"collectionId": 463669628,
				"selections": [
					{
						"specialValue": "4.5",
						"specialValueNumber": 4.5,
						"specialValueString": "4.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 2.5,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044321,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669628
					},
					{
						"specialValue": "4.5",
						"specialValueNumber": 4.5,
						"specialValueString": "4.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 1.39,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1522044322,
						"smartCode": 14018,
						"status": "VALID",
						"oddCollectionID": 463669628
					}
				],
				"name": "Total Goals 4.5",
				"typeId": 160,
				"specialValue": "4.5",
				"oddsDescription": "Predict whether the number of goals scored in a match will be under/over the value specified.",
			}
		]
	},
	{
		"collectionId": 463669632,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1X",
				"typeId": 9,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.81,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044340,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669632
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "12",
				"typeId": 10,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.19,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044341,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669632
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "X2",
				"typeId": 11,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.24,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044342,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669632
			}
		],
		"name": "Double Chance",
		"typeId": 146,
		"specialValue": "0",
		"oddsDescription": "Predict the final outcome of the match at regular time. There are 3 possible outcomes: 1X (home team wins or draws), X2 (away team wins or draws), 12 (home team wins or the away team wins).",
	},
	{
		"collectionId": 463669639,
		"selections": [
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "1 or Over",
				"typeId": 2354,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.18,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044359,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "X or Over",
				"typeId": 2352,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.12,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044361,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "2 or Over",
				"typeId": 2350,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.12,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044363,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "1 or Under",
				"typeId": 2355,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 1.92,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044360,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "X or Under",
				"typeId": 2353,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 2.33,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044362,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "2 or Under",
				"typeId": 2351,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 1.33,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044364,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669639
			}
		],
		"name": "Chance Mix Total Goals 2.5",
		"typeId": 9648,
		"specialValue": "2.5",
		"oddsDescription": "Predict the outcome of a match betting on two related bet types. If at least one selection is correct, the bet is winning. In case both selections are correct, the winnings won't be doubled.",
	},
	{
		"collectionId": 463829986,
		"selections": [
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "1X And Over",
				"typeId": 1727,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 2.09,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590398,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			},
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "12 And Over",
				"typeId": 1728,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.31,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590540,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			},
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "X2 And Over",
				"typeId": 1729,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.37,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590594,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			},
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "1X And Under",
				"typeId": 1724,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 13,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590120,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			},
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "12 And Under",
				"typeId": 1725,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 9.4,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590207,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			},
			{
				"specialValue": "1.5",
				"specialValueNumber": 1.5,
				"specialValueString": "1.5",
				"name": "X2 And Under",
				"typeId": 1726,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 10,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590316,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829986
			}
		],
		"name": "Double Chance & Total Goals 1.5",
		"typeId": 9888,
		"specialValue": "1.5",
		"oddsDescription": "Predict the combination of 2 possible outcomes of a match from 3 possible permutations: home or draw | away or draw | home or away and predict whether the number of goals scored in a match will be under/over the number specified.",
	},
	{
		"collectionId": 463829976,
		"selections": [
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "1X And Over",
				"typeId": 1727,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 2.85,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590294,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "12 And Over",
				"typeId": 1728,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.48,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590376,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "X2 And Over",
				"typeId": 1729,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 1.7,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590466,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "1X And Under",
				"typeId": 1724,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 5.1,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590121,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "12 And Under",
				"typeId": 1725,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 5.1,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590159,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			},
			{
				"specialValue": "2.5",
				"specialValueNumber": 2.5,
				"specialValueString": "2.5",
				"name": "X2 And Under",
				"typeId": 1726,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 4.05,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590234,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829976
			}
		],
		"name": "Double Chance & Total Goals 2.5",
		"typeId": 9888,
		"specialValue": "2.5",
		"oddsDescription": "Predict the combination of 2 possible outcomes of a match from 3 possible permutations: home or draw | away or draw | home or away and predict whether the number of goals scored in a match will be under/over the number specified.",
	},
	{
		"collectionId": 463829974,
		"selections": [
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "1X And Over",
				"typeId": 1727,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 3.75,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590372,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			},
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "12 And Over",
				"typeId": 1728,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 2.11,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590441,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			},
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "X2 And Over",
				"typeId": 1729,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 2.21,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590561,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			},
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "1X And Under",
				"typeId": 1724,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 3.7,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590087,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			},
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "12 And Under",
				"typeId": 1725,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 2.45,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590177,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			},
			{
				"specialValue": "3.5",
				"specialValueNumber": 3.5,
				"specialValueString": "3.5",
				"name": "X2 And Under",
				"typeId": 1726,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 2.65,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590289,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829974
			}
		],
		"name": "Double Chance & Total Goals 3.5",
		"typeId": 9888,
		"specialValue": "3.5",
		"oddsDescription": "Predict the combination of 2 possible outcomes of a match from 3 possible permutations: home or draw | away or draw | home or away and predict whether the number of goals scored in a match will be under/over the number specified.",
	},
	{
		"collectionId": 463829996,
		"selections": [
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "1X And Over",
				"typeId": 1727,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 6.8,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590514,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			},
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "12 And Over",
				"typeId": 1728,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 2.9,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590525,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			},
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "X2 And Over",
				"typeId": 1729,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 3.5,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590572,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			},
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "1X And Under",
				"typeId": 1724,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 2.6,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590202,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			},
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "12 And Under",
				"typeId": 1725,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 1.86,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590310,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			},
			{
				"specialValue": "4.5",
				"specialValueNumber": 4.5,
				"specialValueString": "4.5",
				"name": "X2 And Under",
				"typeId": 1726,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 1.83,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522590415,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463829996
			}
		],
		"name": "Double Chance & Total Goals 4.5",
		"typeId": 9888,
		"specialValue": "4.5",
		"oddsDescription": "Predict the combination of 2 possible outcomes of a match from 3 possible permutations: home or draw | away or draw | home or away and predict whether the number of goals scored in a match will be under/over the number specified.",
	},
	{
		"collectionId": 463669626,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "GG",
				"typeId": 74,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.31,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044319,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669626
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "NG",
				"typeId": 76,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 2.8,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044320,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669626
			}
		],
		"name": "GG/NG",
		"typeId": 302,
		"specialValue": "0",
		"oddsDescription": "Predict if both teams will each score at least one goal each during the match. The bet offers two possible outcomes: GG (both teams will score at least one goal during the match); NG (one or both teams will fail to score a goal during the match).",
	},
	{
		"collectionId": 463669631,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1 DNB",
				"typeId": 4,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 2.6,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044338,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669631
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "2 DNB",
				"typeId": 5,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.36,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044339,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669631
			}
		],
		"name": "Draw No Bet",
		"typeId": 147,
		"specialValue": "0",
		"oddsDescription": "Standard DNB: Predict which team will win a match. Bets placed on this market will be void if the match ends in a draw.\r\n Fantasy DNB: Predict which team/player will score most goals in their respective matches. If both teams/players score the same number of goals, bets will be void. Both players must start the match. If either or both players do not start Goalscorer bets will be void. Extra-Time and Penalty shoot-out goals do not count.",
	},
	{
		"collectionId": 463669630,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "HH",
				"typeId": 418,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 5.6,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044323,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "HD",
				"typeId": 420,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 15,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044326,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "HA",
				"typeId": 422,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 19,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044329,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "DH",
				"typeId": 424,
				"order": 4,
				"selectionDescription": "",
				"odd": {
					"value": 9.2,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044324,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "DD",
				"typeId": 426,
				"order": 5,
				"selectionDescription": "",
				"odd": {
					"value": 8,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044327,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "DA",
				"typeId": 428,
				"order": 6,
				"selectionDescription": "",
				"odd": {
					"value": 5.4,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044330,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "AH",
				"typeId": 430,
				"order": 7,
				"selectionDescription": "",
				"odd": {
					"value": 30,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044325,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "AD",
				"typeId": 432,
				"order": 8,
				"selectionDescription": "",
				"odd": {
					"value": 14,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044328,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "AA",
				"typeId": 434,
				"order": 9,
				"selectionDescription": "",
				"odd": {
					"value": 2.5,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1522044331,
				"smartCode": 14018,
				"status": "VALID",
				"oddCollectionID": 463669630
			}
		],
		"name": "HT/FT",
		"typeId": 9881,
		"specialValue": "0",
		"oddsDescription": "Predict the outcome of the first half and the final outcome of the match. A halftime/full time bet is considered a winning only if both predictions of the halftime and full time are correct.",
	}
]

const providerBasketballMarket = {
	"money_line": {
		"home": 1.348,
		"draw": null,
		"away": 2.94
	},
	"spreads": {
		"-5.5": {
			"hdp": -5.5,
			"alt_line_id": null,
			"home": 1.862,
			"away": 1.877,
			"max": 200
		},
		"-8.0": {
			"hdp": -8,
			"alt_line_id": 50447121400,
			"home": 2.26,
			"away": 1.571,
			"max": 200
		},
		"-7.5": {
			"hdp": -7.5,
			"alt_line_id": 50447121401,
			"home": 2.18,
			"away": 1.617,
			"max": 200
		},
		"-7.0": {
			"hdp": -7,
			"alt_line_id": 50447121402,
			"home": 2.1,
			"away": 1.666,
			"max": 200
		},
		"-6.5": {
			"hdp": -6.5,
			"alt_line_id": 50447121403,
			"home": 2.02,
			"away": 1.724,
			"max": 200
		},
		"-6.0": {
			"hdp": -6,
			"alt_line_id": 50447121404,
			"home": 1.943,
			"away": 1.793,
			"max": 200
		},
		"-5.0": {
			"hdp": -5,
			"alt_line_id": 50447121405,
			"home": 1.781,
			"away": 1.961,
			"max": 200
		},
		"-4.5": {
			"hdp": -4.5,
			"alt_line_id": 50447121406,
			"home": 1.709,
			"away": 2.04,
			"max": 200
		},
		"-4.0": {
			"hdp": -4,
			"alt_line_id": 50447121407,
			"home": 1.649,
			"away": 2.12,
			"max": 200
		},
		"-3.5": {
			"hdp": -3.5,
			"alt_line_id": 50447121408,
			"home": 1.602,
			"away": 2.2,
			"max": 200
		},
		"-3.0": {
			"hdp": -3,
			"alt_line_id": 50447121409,
			"home": 1.558,
			"away": 2.28,
			"max": 200
		}
	},
	"totals": {
		"148.5": {
			"points": 153.5,
			"alt_line_id": null,
			"over": 1.892,
			"under": 1.847,
			"max": 200
		},
		"149.5": {
			"points": 151,
			"alt_line_id": 50447121410,
			"over": 1.671,
			"under": 2.12,
			"max": 200
		},
		"151.5": {
			"points": 151.5,
			"alt_line_id": 50447121411,
			"over": 1.704,
			"under": 2.06,
			"max": 200
		},
		"152.0": {
			"points": 152,
			"alt_line_id": 50447121412,
			"over": 1.746,
			"under": 2.01,
			"max": 200
		},
		"152.5": {
			"points": 152.5,
			"alt_line_id": 50447121413,
			"over": 1.787,
			"under": 1.952,
			"max": 200
		},
		"153.0": {
			"points": 153,
			"alt_line_id": 50447121414,
			"over": 1.84,
			"under": 1.9,
			"max": 200
		},
		"154.0": {
			"points": 154,
			"alt_line_id": 50447121415,
			"over": 1.952,
			"under": 1.793,
			"max": 200
		},
		"154.5": {
			"points": 154.5,
			"alt_line_id": 50447121416,
			"over": 2.01,
			"under": 1.746,
			"max": 200
		},
		"155.0": {
			"points": 155,
			"alt_line_id": 50447121417,
			"over": 2.06,
			"under": 1.704,
			"max": 200
		},
		"155.5": {
			"points": 155.5,
			"alt_line_id": 50447121418,
			"over": 2.12,
			"under": 1.666,
			"max": 200
		},
		"156.0": {
			"points": 156,
			"alt_line_id": 50447121419,
			"over": 2.18,
			"under": 1.632,
			"max": 200
		}
	},
	"team_total": null,
	"sportId": "3",
	"periodNumber": 0
}


const bookmakerBasketballMarket = [
	{
		"collectionId": 464456410,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1",
				"typeId": 4,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.38,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631779,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456410
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "2",
				"typeId": 5,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 2.81,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631780,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456410
			}
		],
		"name": "Moneyline",
		"typeId": 9300,
		"specialValue": "0",
		"oddsDescription": "Predict the winning team (1 or 2) at the end of a match, overtime included. If the match ends in a draw at the end of regular time, the result is decided by the score after the overtime.",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 9300,
		"templateType": 0,
		"oddsTypeOrder": 10,
		"onlyRegularTime": false,
		"multilineType": 0,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": 0,
		"combinability": 1,
		"groupNo": 0,
		"id": 464456410
	},
	{
		"collectionId": 464456411,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1",
				"typeId": 4,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.46,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631783,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456411
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "X",
				"typeId": 2,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 13.89,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631784,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456411
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "2",
				"typeId": 5,
				"order": 3,
				"selectionDescription": "",
				"odd": {
					"value": 3.1,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631785,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456411
			}
		],
		"name": "1X2 - Regular Time",
		"typeId": 110,
		"specialValue": "0",
		"oddsDescription": "Predict the final outcome of a match at the end of the regular time with either the win of the home team (1), a draw (X) or the win of the away team (2).",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 110,
		"templateType": 0,
		"oddsTypeOrder": 20,
		"onlyRegularTime": false,
		"multilineType": 0,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": 0,
		"combinability": 1,
		"groupNo": 0,
		"id": 464456411
	},
	{
		"collectionId": 464483132,
		"selections": [
			{
				"specialValue": "148.5",
				"specialValueNumber": 148.5,
				"specialValueString": "148.5",
				"name": "Over",
				"typeId": 12,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.8,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524719243,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464483132
			},
			{
				"specialValue": "148.5",
				"specialValueNumber": 148.5,
				"specialValueString": "148.5",
				"name": "Under",
				"typeId": 13,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.91,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524719244,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464483132
			}
		],
		"name": "Total (Incl. Overtime)",
		"typeId": 9302,
		"specialValue": "148.5",
		"oddsDescription": "Predict whether the total number of points scored during the match will be over or under the indicated score line, overtime included.",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 9302,
		"templateType": 1,
		"oddsTypeOrder": 40,
		"onlyRegularTime": false,
		"multilineType": 1,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": 148.5,
		"combinability": 1,
		"groupNo": 0,
		"id": 464483132,
		"spreadMarkets": [
			{
				"collectionId": 464483132,
				"selections": [
					{
						"specialValue": "148.5",
						"specialValueNumber": 148.5,
						"specialValueString": "148.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 1.8,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524719243,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464483132
					},
					{
						"specialValue": "148.5",
						"specialValueNumber": 148.5,
						"specialValueString": "148.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 1.91,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524719244,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464483132
					}
				],
				"name": "Total (Incl. Overtime)",
				"typeId": 9302,
				"specialValue": "148.5",
				"oddsDescription": "Predict whether the total number of points scored during the match will be over or under the indicated score line, overtime included.",
				"isOutright": false,
				"isGoalScorer": false,
				"iDGroup": null,
				"iDGroupMarketType": 9302,
				"templateType": 1,
				"oddsTypeOrder": 40,
				"onlyRegularTime": false,
				"multilineType": 1,
				"oddCollectionID": 0,
				"scheduleStatus": 0,
				"specialBetValue": 148.5,
				"combinability": 1,
				"groupNo": 0,
				"id": 464483132
			},
			{
				"collectionId": 464479078,
				"selections": [
					{
						"specialValue": "149.5",
						"specialValueNumber": 149.5,
						"specialValueString": "149.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 1.89,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524706588,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464479078
					},
					{
						"specialValue": "149.5",
						"specialValueNumber": 149.5,
						"specialValueString": "149.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 1.82,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524706590,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464479078
					}
				],
				"name": "Total (Incl. Overtime)",
				"typeId": 9302,
				"specialValue": "149.5",
				"oddsDescription": "Predict whether the total number of points scored during the match will be over or under the indicated score line, overtime included.",
				"isOutright": false,
				"isGoalScorer": false,
				"iDGroup": null,
				"iDGroupMarketType": 9302,
				"templateType": 1,
				"oddsTypeOrder": 40,
				"onlyRegularTime": false,
				"multilineType": 1,
				"oddCollectionID": 0,
				"scheduleStatus": 0,
				"specialBetValue": 149.5,
				"combinability": 1,
				"groupNo": 0,
				"id": 464479078
			},
			{
				"collectionId": 464475166,
				"selections": [
					{
						"specialValue": "150.5",
						"specialValueNumber": 150.5,
						"specialValueString": "150.5",
						"name": "Over",
						"typeId": 12,
						"order": 1,
						"selectionDescription": "",
						"odd": {
							"value": 1.98,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524694404,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464475166
					},
					{
						"specialValue": "150.5",
						"specialValueNumber": 150.5,
						"specialValueString": "150.5",
						"name": "Under",
						"typeId": 13,
						"order": 2,
						"selectionDescription": "",
						"odd": {
							"value": 1.74,
							"unboostedOddValue": null,
							"scheduleStatus": 0
						},
						"id": 1524694405,
						"smartCode": 15077,
						"status": "VALID",
						"oddCollectionID": 464475166
					}
				],
				"name": "Total (Incl. Overtime)",
				"typeId": 9302,
				"specialValue": "150.5",
				"oddsDescription": "Predict whether the total number of points scored during the match will be over or under the indicated score line, overtime included.",
				"isOutright": false,
				"isGoalScorer": false,
				"iDGroup": null,
				"iDGroupMarketType": 9302,
				"templateType": 1,
				"oddsTypeOrder": 40,
				"onlyRegularTime": false,
				"multilineType": 1,
				"oddCollectionID": 0,
				"scheduleStatus": 0,
				"specialBetValue": 150.5,
				"combinability": 1,
				"groupNo": 0,
				"id": 464475166
			}
		]
	},
	{
		"collectionId": 464456412,
		"selections": [
			{
				"specialValue": "0 : 5.5",
				"specialValueNumber": -5.5,
				"specialValueString": "0 : 5.5",
				"name": "1 AH",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.85,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631781,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456412
			},
			{
				"specialValue": "0 : 5.5",
				"specialValueNumber": -5.5,
				"specialValueString": "0 : 5.5",
				"name": "2 AH",
				"typeId": 1715,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.82,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631782,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456412
			}
		],
		"name": "Handicap (Incl. Overtime) -5.5",
		"typeId": 9322,
		"specialValue": "0 : 5.5",
		"oddsDescription": "Predict the outcome of a match after the handicap has been applied to the match result. The handicap value is shown in brackets. Asian handicaps eliminate the chance of a draw, with two possible outcomes - Home team win (1H) or Away team win (2H).",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 9322,
		"templateType": 1,
		"oddsTypeOrder": 80,
		"onlyRegularTime": false,
		"multilineType": 1,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": -5.5,
		"combinability": 1,
		"groupNo": 0,
		"id": 464456412
	},
	{
		"collectionId": 464456412,
		"selections": [
			{
				"specialValue": "0 : 7.5",
				"specialValueNumber": -7.5,
				"specialValueString": "0 : 7.5",
				"name": "1 AH",
				"typeId": 1714,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.85,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631781,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456412
			},
			{
				"specialValue": "0 : 7.5",
				"specialValueNumber": -7.5,
				"specialValueString": "0 : 7.5",
				"name": "2 AH",
				"typeId": 1715,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 1.82,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524631782,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456412
			}
		],
		"name": "Handicap (Incl. Overtime) -7.5",
		"typeId": 9322,
		"specialValue": "0 : 5.5",
		"oddsDescription": "Predict the outcome of a match after the handicap has been applied to the match result. The handicap value is shown in brackets. Asian handicaps eliminate the chance of a draw, with two possible outcomes - Home team win (1H) or Away team win (2H).",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 9322,
		"templateType": 1,
		"oddsTypeOrder": 80,
		"onlyRegularTime": false,
		"multilineType": 1,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": -5.5,
		"combinability": 1,
		"groupNo": 0,
		"id": 464456412
	},
	{
		"collectionId": 464456627,
		"selections": [
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "1 DNB",
				"typeId": 4,
				"order": 1,
				"selectionDescription": "",
				"odd": {
					"value": 1.37,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524632376,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456627
			},
			{
				"specialValue": "0",
				"specialValueNumber": 0,
				"specialValueString": "",
				"name": "2 DNB",
				"typeId": 5,
				"order": 2,
				"selectionDescription": "",
				"odd": {
					"value": 2.87,
					"unboostedOddValue": null,
					"scheduleStatus": 0
				},
				"id": 1524632377,
				"smartCode": 15077,
				"status": "VALID",
				"oddCollectionID": 464456627
			}
		],
		"name": "DNB RT",
		"typeId": 147,
		"specialValue": "0",
		"oddsDescription": "Predict which team will win the match. If the teams draw the selection will be voided. Regular time only.",
		"isOutright": false,
		"isGoalScorer": false,
		"iDGroup": null,
		"iDGroupMarketType": 147,
		"templateType": 0,
		"oddsTypeOrder": 110,
		"onlyRegularTime": false,
		"multilineType": 0,
		"oddCollectionID": 0,
		"scheduleStatus": 0,
		"specialBetValue": 0,
		"combinability": 1,
		"groupNo": 0,
		"id": 464456627
	}
]


test("Bot Service Tests", async (t) => {
	let edgerunner;

	t.before(async () => {
		consoleLogSpy.length = 0;
		mock.restoreAll();
		edgerunner = await EdgeRunner.create(
			{
				"provider": {
					"name": "pinnacle",
					"storeData": false,
					"interval": 2,
					"userId": "user_30I2I43w4GgKpp0wHILCzs6HJmU",
					"alertApiUrl": "https://swordfish-production.up.railway.app/alerts/user_30I2I43w4GgKpp0wHILCzs6HJmU"
				},
				"bookmaker": {
					"name": "betking",
					"storeData": false,
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

		);
	});

	await t.test("Evaluate function for football", async (t) => {
		const result = edgerunner.bridgeMarket(bookmakerFootballMarket, providerFootballMarket);
		console.log("================ FOOTBALL ================");
		// console.log(JSON.stringify(result, null, 2));
		console.log("===========================================");
	});

	await t.test("Evaluate function for basketball", { skip: true }, async (t) => {
		const result = edgerunner.bridgeMarket(bookmakerBasketballMarket, providerBasketballMarket);
		console.log("================ BASKETBALL ===============");
		// console.log(JSON.stringify(result, null, 2));
		console.log("============================================");
	});

	await t.test("Evaluate function for basketball", { skip: true }, async (t) => {
		const result = edgerunner.evaluateMarket(bookmakerFootballMarket, providerFootballMarket);
		console.log("================ xxxxxxxxx ================");
		console.log(JSON.stringify(result, null, 2));
		console.log("===========================================");
	});

	t.after(async () => {
		await edgerunner.stop();
	});
});
