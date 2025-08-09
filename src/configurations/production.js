const configurations = {
	apiBaseUrl: "https://edge-runner-p35d.onrender.com",
	DATABASE_PATH: "/data/main.db",
	provider: {
		name: "pinnacle",
		storeData: false,
		interval: 20,
		userId: "user_2tx1tBtUOvXZXyUU8BaQ5Bpy15W",
		baseUrl: `https://swordfish-production.up.railway.app/alerts/{user_id}?dropNotificationsCursor={drop_id}`,
		alertApiUrl: null // Computed below
	},
	bookmaker: {
		name: "betking",
		storeData: false,
		interval: 10,
		username: "07033054766",
		password: "A1N2S3I4"
	},
	edgeRunner: {
		name: "edgeRunner",
		stakeFraction: 0.1,
		fixedStake: {
			enabled: true, // Set to true to use fixed stake, false to use calculated stake
			value: 10
		},
		minValueBetPercentage: 0 // percentage the value bet shoud exceed
	},
	cron: {
		intervalMin: 10
	}
};

configurations.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${configurations.provider.userId}`;

export default configurations;

