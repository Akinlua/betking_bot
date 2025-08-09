// Good -> USER_ID: "user_2tx1tBtUOvXZXyUU8BaQ5Bpy15W" -> macji
// Better -> USER_ID: "user_30I2I43w4GgKpp0wHILCzs6HJmU" -> josiahmarvelous615@gmail.com
// Best -> "user_2VqFOsEjFG0YgEAhZDvFe4QE6yf" -> godwinraymond99@gmail.com

const configurations = {
    apiBaseUrl: "http://localhost:9090",
	DATABASE_PATH: "./data/main.db",
	provider: {
		storeData: true,
		interval: 2, // in seconds
		userId: "user_30I2I43w4GgKpp0wHILCzs6HJmU",
		baseUrl: `https://swordfish-production.up.railway.app/alerts/{user_id}?dropNotificationsCursor={drop_id}`
	},
	bookmaker: {
		storeData: true,
		interval: 2 // in seconds
	},
	cron: {
		intervalMin: 10 // in minutes
	}
};

configurations.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${configurations.provider.userId}`;

export default configurations;

