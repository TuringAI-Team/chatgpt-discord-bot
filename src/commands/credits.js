import { SlashCommandBuilder } from "discord.js";
import { getUser, updateCredits } from "../modules/user.js";
export default {
  data: new SlashCommandBuilder()
    .setName("credits")
    .setDescription("See your available credits"),
  async execute(interaction) {
    var user = await getUser(interaction.user);

    return interaction.reply({
      ephemeral: true,
      content: `${interaction.user} you have a total of ${user.credits} credits.\nIf you want more credits read <#1047053083710079026>`,
    });
  },
};
