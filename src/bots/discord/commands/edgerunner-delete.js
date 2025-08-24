import { SlashCommandBuilder, MessageFlags } from "discord.js";
import configurations from "../../../../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

export default {
	data: new SlashCommandBuilder()
		.setName("runner-delete")
		.setDescription("Stops, cleans up, and deletes all data for a bot.")
		.addStringOption(option =>
			option.setName("username")
				.setDescription("The username (11-digit ID) of the bot to permanently delete.")
				.setRequired(true)),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: MessageFlags.Ephemeral });

		const username = interaction.options.getString("username");

		if (username.length !== 11 || !/^\d+$/.test(username)) {
			return await interaction.editReply("❌ **Invalid Username:** Please provide the 11-digit username of the bot to delete.");
		}

		try {
			const response = await fetch(`${apiBase}/delete/${username}`, {
				method: "DELETE",
			});

			const result = await response.json();
			if (response.ok) {
				await interaction.editReply(`✅ **Success:** ${result.message}`);
			} else {
				await interaction.editReply(`❌ **Failed:** ${result.error}`);
			}
		} catch (err) {
			console.error(err);
			await interaction.editReply("❌ An error occurred while connecting to the bot server.");
		}
	}
}
