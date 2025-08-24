import { SlashCommandBuilder, EmbedBuilder } from "discord.js";
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
        await interaction.deferReply({ ephemeral: true });
        
        const pm_id = interaction.options.getString("username");

        try {
            const response = await fetch(`${apiBase}/status/${pm_id}`);
            const result = await response.json();

            if (response.ok) {
                const {
                    isBotActive,
                    bankroll,
                    openBets,
                    queueLength,
                    isWorkerRunning,
                    browserActive,
                    minValueBetOdds,
                    maxValueBetOdds
                } = result;

                const statusEmbed = new EmbedBuilder()
                    .setTitle(`Status for Bot: ${pm_id}`)
                    .setColor(isBotActive ? '#57F287' : '#ED4245') 
                    .addFields(
                        { name: 'Status', value: isBotActive ? '✅ Active' : '🛑 Inactive', inline: true },
                        { name: 'Worker', value: isWorkerRunning ? '🏃 Running' : '💤 Idle', inline: true },
                        { name: 'Browser', value: browserActive ? '🌐 Open' : '🔒 Closed', inline: true },
                        { name: 'Bankroll', value: `₦${bankroll?.toFixed(2) ?? 'N/A'}`, inline: true },
                        { name: 'Open Bets', value: `${openBets ?? 'N/A'}`, inline: true },
                        { name: 'Game Queue', value: `${queueLength ?? 0} games`, inline: true },
                        { name: 'Odds Range', value: `Min: ${minValueBetOdds ?? 'N/A'} | Max: ${maxValueBetOdds ?? 'N/A'}`, inline: false },
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
