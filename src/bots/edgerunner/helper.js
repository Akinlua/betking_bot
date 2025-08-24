const baseConfig = {
	provider: {
		name: "pinnacle",
		storeData: true,
		interval: 10,
		userId: "",
		alertApiUrl: "",
	},
	bookmaker: {
		name: "betking",
		storeData: true,
		interval: 10,
		username: "",
		password: ""
	},
	edgerunner: {
		name: "edgerunner",
		stakeFraction: 0.1,
		fixedStake: { enabled: true, value: 10 },
		minValueBetPercentage: 6,
		minValueBetOdds: 1.45,
		maxValueBetOdds: 4.00,

	}
};

function deepMerge(target, source) {
	const output = { ...target };

	if (typeof target === 'object' && target !== null && typeof source === 'object' && source !== null) {
		for (const key in source) {
			if (Object.prototype.hasOwnProperty.call(source, key)) {
				if (typeof target[key] === 'object' && target[key] !== null && typeof source[key] === 'object' && source[key] !== null) {
					output[key] = deepMerge(target[key], source[key]);
				} else {
					output[key] = source[key];
				}
			}
		}
	}

	return output;
}

function createEdgeRunnerConfig(partial = {}) {
    const config = deepMerge(JSON.parse(JSON.stringify(baseConfig)), partial);

    if (config.provider.userId) {
        config.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${config.provider.userId}`;
    }

    return config;
}

export { baseConfig, createEdgeRunnerConfig };

