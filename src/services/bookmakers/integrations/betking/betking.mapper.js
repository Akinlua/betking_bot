// Note: Sport IDs are defined for the provider's system.
// - sportId=1: Football
// - sportId=3: Basketball (provider); corresponds to bookmaker sportId=2
export const sportIdMapper = {
	'1': 'F', // Football
	'3': 'B', // Basketball
};

export const lineTypeMapper = {
	"money_line": {
		name: "1x2",
		outcome: { "home": "1", "draw": "x", "away": "2" }
	},
	"total": {
		name: "Total",
		outcome: { "over": "Over", "under": "Under" },
		marketsBySport: {
			'1': { '0': 'Total Goals' }, // Football
			'3': { // Basketball
				'0': 'Total (Incl. Overtime)', // Full game
				'1': null,
				'2': null
			},
		},
	},
	"spread": {
		name: "Handicap",
		outcome: { "home": "Home", "away": "Away" },
		marketsBySport: {
			'1': { '0': 'Handicap' }, // Football
			'3': { // Basketball
				'0': 'Handicap (Incl. Overtime)', // Full game
				'1': null,
				'2': null
			},
		},
	}
};
