const configurations = {
	apiBaseUrl: "https://edge-runner-p35d.onrender.com",
	DATABASE_PATH: "/data/main.db",
	provider: {
		storeData: false,
		interval: 20,
		userId: "user_2tx1tBtUOvXZXyUU8BaQ5Bpy15W",
		baseUrl: `https://swordfish-production.up.railway.app/alerts/{user_id}?dropNotificationsCursor={drop_id}`
	},
	bookmaker: {
		storeData: false,
		interval: 10
	},
	cron: {
		intervalMin: 10
	}
};

configurations.provider.alertApiUrl = `https://swordfish-production.up.railway.app/alerts/${configurations.provider.userId}`;

export default configurations;

