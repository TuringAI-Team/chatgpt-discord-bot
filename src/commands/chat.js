import { SlashCommandBuilder } from "discord.js";
import { chat } from "../modules/gpt.js";
import { getUser } from "../modules/user.js";

export default {
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
    await interaction.reply({
      content: `Loading...`,
    });
    var result = await chat(message);
    console.log(result);
    await interaction.editReply(result);

    return;
  },
};
