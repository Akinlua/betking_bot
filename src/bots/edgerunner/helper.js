import pkg from 'lodash';
const { merge } = pkg;

const baseConfig = {
	provider: {
		name: "pinnacle",
		storeData: false,
		interval: 10, // 30 to slow
		userId: "",
		alertApiUrl: "",
	},
	bookmaker: {
		name: "betking",
		storeData: false,
		interval: 30,
		username: "",
		password: ""
	},
	edgerunner: {
		name: "edgerunner",
		stakeFraction: 0.1,
		fixedStake: { enabled: true, value: 10 },
		minValueBetPercentage: 5.5,
		minValueBetOdds: 1.45,
		maxValueBetOdds: 3.50,
		delay: 10 // 30 to slow
	},
	proxy: {
		enabled: false, 
		ip: "",
		password: "",
		username: ""
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

