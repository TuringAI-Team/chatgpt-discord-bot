import { SlashCommandBuilder, time } from "discord.js";
import { getUser } from "../modules/user.js";
import { addToken } from "../modules/loadbalancer.js";

export default {
  data: new SlashCommandBuilder()
    .setName("session-token")
    .setDescription(
      "Add your session token to the bot in order to mantain it online"
    )
    .addStringOption((option) =>
      option
        .setName("sessiontoken")
        .setDescription("Your session token from chatgpt")
        .setRequired(true)
    ),
  async execute(interaction, client) {
    var token = interaction.options.getString("sessiontoken");
    interaction.reply({
      content: `Adding your session token...`,
      ephemeral: true,
    });
    await addToken(token);
    interaction.editReply("Token added successfully");
    return;
  },
};
