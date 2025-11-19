import { SlashCommandBuilder } from "discord.js";
import configurations from "../../../../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

export default
	{
		data: new SlashCommandBuilder()
			.setName("runner-start")
			.setDescription("Start a new EdgeRunner bot")
			.addStringOption(option =>
				option.setName("username")
					.setDescription("Bookmaker username")
					.setRequired(true))
			.addStringOption(option =>
				option.setName("password")
					.setDescription("Bookmaker password")
					.setRequired(true))
			.addStringOption(option =>
				option.setName("userid")
					.setDescription("Provider userId")
					.setRequired(true))
			.addNumberOption(option =>
				option.setName("fixedstake")
					.setDescription("Fixed stake value")
					.setRequired(true))
			.addBooleanOption(option =>
				option.setName("placement-single")
					.setDescription("Enable placing single bets (default: true)")
					.setRequired(false))
			.addBooleanOption(option =>
				option.setName("placement-multiple")
					.setDescription("Enable placing multiple bets (default: true)")
					.setRequired(false))
			.addBooleanOption(option =>
				option.setName("placement-new-test")
					.setDescription("Enable placing test bets (default: true)")
					.setRequired(false))
			.addBooleanOption(option =>
				option.setName("use-proxy")
					.setDescription("Enable to use a proxy for this bot (default: false)")
					.setRequired(false)) // Optional
			.addStringOption(option =>
				option.setName("proxy-ip")
					.setDescription("The proxy ip + port number (e.g., 109.107.54.237:8080)")
					.setRequired(false)) // Optional
			.addStringOption(option =>
				option.setName("proxy-user")
					.setDescription("Username for the proxy (only if use-proxy is true)")
					.setRequired(false)) // Optional
			.addStringOption(option =>
				option.setName("proxy-pass")
					.setDescription("Password for the proxy (only if use-proxy is true)")
					.setRequired(false)),
		async execute(interaction) {
			await interaction.deferReply({ ephemeral: true });

			const username = interaction.options.getString("username");
			const password = interaction.options.getString("password");
			const userId = interaction.options.getString("userid");
			const fixedStake = interaction.options.getNumber("fixedstake");
			const useProxy = interaction.options.getBoolean("use-proxy") ?? false;
			const placementSingle = interaction.options.getBoolean("placement-single");
			const placementMultiple = interaction.options.getBoolean("placement-multiple");
			const placementTest = interaction.options.getBoolean("placement-new-test");

			const payload = {
				provider: { userId },
				bookmaker: { username, password },
			    edgerunner: {
        			fixedStake: {
            			enabled: true,
            			value: fixedStake
        			}
    			}
			};

			const betPlacement = {};
			if (placementSingle !== null) betPlacement.single = placementSingle;
			if (placementMultiple !== null) betPlacement.multiple = placementMultiple;
			if (Object.keys(betPlacement).length > 0) {
				payload.edgerunner.betPlacement = betPlacement;
			}

			if (useProxy) {
				const proxyIp = interaction.options.getString("proxy-ip");
				const proxyUser = interaction.options.getString("proxy-user");
				const proxyPass = interaction.options.getString("proxy-pass");

				if (!proxyIp || !proxyUser || !proxyPass) {
					return await interaction.editReply("❌ **Proxy Error:** If 'use-proxy' is true, you must provide a proxy username and password.");
				}

				payload.proxy = {
					enabled: true,
					ip: proxyIp,
					username: proxyUser,
					password: proxyPass
				};
			}

			if (username.length !== 11 || !/^\d+$/.test(username)) {
				return await interaction.editReply("❌ **Invalid Username:** Please provide a valid 11-digit phone number.");
			}

			try {
				const response = await fetch(`${apiBase}/start`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload)
				});

				const result = await response.json();
				if (response.ok) {
					await interaction.editReply(`✅ Bot started: ${result.name} (ID: ${result.pm_id})`);
				} else {
					await interaction.editReply(`❌ Failed: ${result.error}`);
				}
			} catch (err) {
				console.error(err);
				await interaction.editReply("❌ Error connecting to server.");
			}
		}
	}
