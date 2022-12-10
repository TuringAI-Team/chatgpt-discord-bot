const { SlashCommandBuilder } = require("discord.js");
const { chat } = require("../modules/gpt.js");
const { getUser } = require("../modules/user");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chat")
    .setDescription("Chat with gpt-3")
    .addStringOption((option) =>
      option
        .setName("message")
        .setDescription("The message for gpt-3")
        .setRequired(true)
    ),
  async execute(interaction) {
    var user = await getUser(interaction.user);
    var message = interaction.options.getString("message");
    var result = await chat(message);
    await interaction.reply({
      content: result,
      ephemeral: true,
    });

    return;
  },
};
