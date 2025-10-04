import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from "discord.js";
import configurations from "../../../../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

export default {
  data: new SlashCommandBuilder()
    .setName("runner-status")
    .setDescription("Gets the live status of a running bot.")
    .addStringOption((opt) => opt.setName("username").setDescription("The bookmaker account username of the bot.").setRequired(true)),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: MessageFlags.Ephemeral });

    const pm_id = interaction.options.getString("username");

    try {
      const response = await fetch(`${apiBase}/status/${pm_id}`);
      const result = await response.json();

      if (response.ok) {
        // ... existing imports (assuming EmbedBuilder, interaction, result, etc. are available) ...

        const statusEmbed = new EmbedBuilder()
          .setTitle(`📊 Status for Bot: ${pm_id}`)
          // Set color based on overall bot activity
          .setColor(result.edgerunner?.isActive ? "#57F287" : "#ED4245")
          .addFields(
            // =========================================================
            // 1. CORE STATUS & QUEUE
            // =========================================================
            {
              name: "Bot Status",
              value: result.edgerunner?.isActive ? "✅ Active" : "🛑 Inactive",
              inline: true,
            },
            {
              name: "Worker",
              value: result.edgerunner?.isWorkerRunning ? "🏃 Running" : "💤 Idle",
              inline: true,
            },
            {
              name: "Game Queue",
              value: `\`${result.edgerunner?.queueLength ?? 0}\` games`,
              inline: true,
            },

            // =========================================================
            // 2. DAILY PERFORMANCE
            // =========================================================
            {
              name: "Bankroll",
              value: `💰 **₦${result.bookmaker?.balance?.toFixed(2) ?? "N/A"}**`,
              inline: true,
            },
            {
              name: "Daily Change (₦)",
              // Use conditional color for change
              value: `\u200b ${result.edgerunner.dailyBalanceChange > 0 ? "🟢" : result.edgerunner.dailyBalanceChange < 0 ? "🔴" : "⚪"} \`${result.edgerunner?.dailyBalanceChange ?? "0.00"}\``,
              inline: true,
            },
            {
              name: "Daily Change (%)",
              value: `\u200b ${result.edgerunner.dailyBalanceChange > 0 ? "🟢" : result.edgerunner.dailyBalanceChange < 0 ? "🔴" : "⚪"} \`${result.edgerunner?.dailyChangePercent ?? "0.00"}%\``,
              inline: true,
            },

            // =========================================================
            // 3. BETTING STATS
            // =========================================================
            {
              name: "Today Bets",
              value: `📈 \`${result.edgerunner?.betsPlacedToday ?? 0}\``,
              inline: true,
            },
            {
              name: "Total Bets",
              value: `🧾 \`${result.edgerunner?.totalBetsPlaced ?? 0}\``,
              inline: true,
            },
            {
              name: "Open Bets",
              value: `🎫 \`${result.bookmaker?.openBets ?? "N/A"}\``,
              inline: true,
            },
            {
              name: "Possible Bets",
              value: `🎫 \`${result.edgerunner.possibleBetsCount ?? "N/A"}\``,
              inline: false,
            },
            // =========================================================
            //  CONFIGURATION
            // =========================================================
            {
              name: "Min Value %", 
              value: `**${result.edgerunner?.minValueBetPercentage ?? "N/A"}%**`,
              inline: true, 
            },
            {
              name: "Stake Amount",
              value: `\`${result.edgerunner?.stakeAmount ?? "N/A"}\``,
              inline: true, 
            },
            {
              name: "Odds Range", 
              value: `\`${result.edgerunner?.minValueBetOdds ?? "N/A"}\` ↔ \`${result.edgerunner?.maxValueBetOdds ?? "N/A"}\``,
              inline: true, // Keep false to ensure it uses the full width
            },
            // =========================================================
            // HEALTH
            // =========================================================
            {
              name: "Provider Status",
              value: `\`\`\`json\n${JSON.stringify(result.provider?.status?.status, null, 2) ?? '"N/A"'}\n\`\`\``,
              inline: true,
            },
            {
              name: "Bookmaker Status",
              value: `\`\`\`json\n${JSON.stringify(result.bookmaker?.status?.status, null, 2) ?? '"N/A"'}\n\`\`\``,
              inline: true,
            },
          )
          .setTimestamp()
          .setFooter({ text: "EdgeRunner Bot Status" });
        await interaction.editReply({ embeds: [statusEmbed] });
      } else {
        await interaction.editReply(`❌ **Failed to get status:** ${result.error}`);
      }
    } catch (err) {
      console.error(err);
      await interaction.editReply("❌ An error occurred while connecting to the bot server.");
    }
  },
};
