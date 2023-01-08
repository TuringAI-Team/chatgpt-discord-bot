import { SlashCommandBuilder, time } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("feedback")
    .setDescription("Send us feedback")
    .addStringOption((option) =>
      option
        .setName("feedback")
        .setDescription("The message we will receive")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("type")
        .setDescription("The feedback type")
        .setRequired(true)
        .addChoices(
          { name: "Report a bug", value: "bug" },
          { name: "Suggestion", value: "suggestion" },
          { name: "Other", value: "other" }
        )
    ),
  async execute(interaction, client) {
    var message = interaction.options.getString("feedback");
    var type = interaction.options.getString("type");

    const channel = client.channels.cache.get("1051425293715390484");
    await interaction.reply({
      content: `Sending...`,
      ephemeral: true,
    });
    const timeString = time(new Date(), "R");
    channel.send(
      `**Feedback from __${interaction.user.tag}__** ${timeString}\n**Message:** ${message}\n**Type:** ${type}`
    );
    await interaction.editReply({
      content: "Feedback sent.",
      ephemeral: true,
    });
    return;
  },
};
