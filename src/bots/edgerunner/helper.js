import pkg from 'lodash';
const { merge } = pkg;

const baseConfig = {
	provider: {
		name: "pinnacle",
		storeData: false,
		interval: 10,
		userId: "",
		alertApiUrl: "",
	},
	bookmaker: {
		name: "betking",
		storeData: false,
		interval: 20,
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
		delay: 10

	}
};

function createEdgeRunnerConfig(partial = {}) {
	const config = merge({}, baseConfig, partial);

    if (config.provider.userId) {
        config.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${config.provider.userId}`;
    }

    return config;
}

export { baseConfig, createEdgeRunnerConfig };

