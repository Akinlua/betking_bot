import { SlashCommandBuilder, MessageFlags } from "discord.js";
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
					.setRequired(true)),
		async execute(interaction) {
			await interaction.deferReply({ ephemeral: MessageFlags.Ephemeral });

			const username = interaction.options.getString("username");
			const password = interaction.options.getString("password");
			const userId = interaction.options.getString("userid");
			const fixedStake = interaction.options.getNumber("fixedstake");

			if (username.length !== 11 || !/^\d+$/.test(username)) {
				return await interaction.editReply("❌ **Invalid Username:** Please provide a valid 11-digit phone number.");
			}

			try {
				const response = await fetch(`${apiBase}/start`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						provider: { userId },
						bookmaker: { username, password },
						edgerunner: fixedStake ? { fixedStakeValue: fixedStake } : {}
					})
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
