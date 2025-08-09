// Good -> USER_ID: "user_2tx1tBtUOvXZXyUU8BaQ5Bpy15W" -> macji
// Better -> USER_ID: "user_30I2I43w4GgKpp0wHILCzs6HJmU" -> josiahmarvelous615@gmail.com
// Best -> "user_2VqFOsEjFG0YgEAhZDvFe4QE6yf" -> godwinraymond99@gmail.com

const configurations = {
	apiBaseUrl: "http://localhost:9090",
	DATABASE_PATH: "./data/main.db",
	provider: {
		name: "pinnacle",
		storeData: true,
		interval: 2, // in seconds
		userId: "user_30I2I43w4GgKpp0wHILCzs6HJmU",
		baseUrl: `https://swordfish-production.up.railway.app/alerts/{user_id}?dropNotificationsCursor={drop_id}`,
		alertApiUrl: null // Computed below
	},
	bookmaker: {
		name: "betking",
		storeData: true,
		interval: 2, // in seconds
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
		minValueBetPercentage: 0
	},
	cron: {
		intervalMin: 10 // in minutes
	},
};

configurations.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${configurations.provider.userId}`;

export default configurations;

