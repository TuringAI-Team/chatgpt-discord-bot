import { SlashCommandBuilder, time } from "discord.js";
import { getUser } from "../modules/user.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Invite the bot to your server"),
  async execute(interaction, client) {
    var user = await getUser(interaction.user);

    await interaction.reply({
      content: `If you want to invite the bot to your server, you can [click here](https://discord.com/api/oauth2/authorize?client_id=1051220396206202960&permissions=277025720384&scope=bot%20applications.commands). The bot use only permissions that it needs to work.`,
      ephemeral: true,
    });

    return;
  },
};
