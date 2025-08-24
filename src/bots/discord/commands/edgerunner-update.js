import { SlashCommandBuilder } from "discord.js";
import configurations from "../../../../configurations/index.js";

const apiBase = `${configurations.apiBaseUrl}/edgerunner`;

export default {
    data: new SlashCommandBuilder()
        .setName("runner-update")
        .setDescription("Update a running bot's live configuration.")
        .addStringOption(opt =>
            opt.setName("username")
               .setDescription("The username of the bot to update.")
               .setRequired(true))
        .addNumberOption(opt =>
            opt.setName("fixedstake")
               .setDescription("Set a new fixed stake value (e.g., 100)."))
        .addNumberOption(opt =>
            opt.setName("stakefraction")
               .setDescription("Set a new stake fraction for Kelly Criterion (e.g., 0.1 for 10%)."))
        .addNumberOption(opt =>
            opt.setName("minvaluebetpercentage") 
               .setDescription("Set the min value percentage to place a bet (e.g., 6 for 6%)."))
        .addNumberOption(opt =>
            opt.setName("minvaluebetodds") 
               .setDescription("Set the minimum odds to place a bet (e.g., 1.45)."))
        .addNumberOption(opt =>
            opt.setName("maxvaluebetodds")
               .setDescription("Set the maximum odds to place a bet (e.g., 4.0).")),
    
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        
        const pm_id = interaction.options.getString("username");
        const fixedStake = interaction.options.getNumber("fixedstake");
        const stakeFraction = interaction.options.getNumber("stakefraction");
        const minValueBetPercentage = interaction.options.getNumber("minvaluebetpercentage");
        const minValueBetOdds = interaction.options.getNumber("minvaluebetodds");
        const maxValueBetOdds = interaction.options.getNumber("maxvaluebetodds");

        const optionsProvided = [fixedStake, stakeFraction, minValueBetPercentage, minValueBetOdds, maxValueBetOdds];
        if (optionsProvided.every(opt => opt === null)) {
            return await interaction.editReply("❌ You must provide at least one configuration option to update.");
        }

        const payload = { edgerunner: {} };

        if (fixedStake !== null) {
            payload.edgerunner.fixedStake = { enabled: true, value: fixedStake };
        }
        if (stakeFraction !== null) {
            payload.edgerunner.stakeFraction = stakeFraction;
        }
        if (minValueBetPercentage !== null) {
            payload.edgerunner.minValueBetPercentage = minValueBetPercentage;
        }
        if (minValueBetOdds !== null) {
            payload.edgerunner.minValueBetOdds = minValueBetOdds;
        }
        if (maxValueBetOdds !== null) {
            payload.edgerunner.maxValueBetOdds = maxValueBetOdds;
        }

        try {
            const response = await fetch(`${apiBase}/config/${pm_id}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            const result = await response.json();
            if (response.ok) {
                await interaction.editReply(`✅ Bot config for **${pm_id}** has been updated successfully.`);
            } else {
                await interaction.editReply(`❌ **Failed:** ${result.error}`);
            }
        } catch (err) {
            console.error(err);
            await interaction.editReply("❌ An error occurred while connecting to the bot server.");
        }
    }
}
