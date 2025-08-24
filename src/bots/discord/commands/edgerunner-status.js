import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import configurations from "../../../../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

export default {
	data: new SlashCommandBuilder()
		.setName("runner-status")
		.setDescription("Gets the live status of a running bot.")
		.addStringOption(opt =>
			opt.setName("username")
				.setDescription("The bookmaker account username of the bot.")
				.setRequired(true)),

	async execute(interaction) {
		await interaction.deferReply({ ephemeral: MessageFlags.Ephemeral });

		const pm_id = interaction.options.getString("username");

		try {
			const response = await fetch(`${apiBase}/status/${pm_id}`);
			const result = await response.json();

			if (response.ok) {
				const statusEmbed = new EmbedBuilder()
					.setTitle(`Status for Bot: ${pm_id}`)
					.setColor(result.isBotActive ? '#57F287' : '#ED4245')
					.addFields(
						// Bot Status
						{ name: 'Bot Status', value: result.isBotActive ? '✅ Active' : '🛑 Inactive', inline: true },
						{ name: 'Worker', value: result.isWorkerRunning ? '🏃 Running' : '💤 Idle', inline: true },
						{ name: 'Game Queue', value: `${result.queueLength ?? 0} games`, inline: true },

						// Live Data
						{ name: 'Bankroll', value: `₦${result.bankroll?.toFixed(2) ?? 'N/A'}`, inline: true },
						{ name: 'Open Bets', value: `${result.openBets ?? 'N/A'}`, inline: true },
						{ name: 'Browser', value: result.browserActive ? '🌐 Open' : '🔒 Closed', inline: true },

						// Connection Health
						{ name: 'Provider', value: `\`${result.providerHealth?.status ?? 'N/A'}\``, inline: false },
						{ name: 'Bookmaker', value: `\`${result.bookmakerHealth?.status ?? 'N/A'}\``, inline: false },

						// Configuration
						{ name: 'Min/Max Odds', value: `${result.minValueBetOdds ?? 'N/A'} / ${result.maxValueBetOdds ?? 'N/A'}`, inline: false }
					)
					.setTimestamp()
					.setFooter({ text: 'EdgeRunner Bot Status' });

				await interaction.editReply({ embeds: [statusEmbed] });

			} else {
				await interaction.editReply(`❌ **Failed to get status:** ${result.error}`);
			}

		} catch (err) {
			console.error(err);
			await interaction.editReply("❌ An error occurred while connecting to the bot server.");
		}
	}
}
