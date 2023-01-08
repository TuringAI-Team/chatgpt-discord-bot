import { SlashCommandBuilder, time } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("invite")
    .setDescription("Invite the bot to your server"),
  async execute(interaction, client) {
    await interaction.reply({
      content: `If you want to invite the bot to your server, you can [click here](https://discord.com/api/oauth2/authorize?client_id=1053015370115588147&permissions=277025736768&scope=bot%20applications.commands). The bot use only permissions that it needs to work.`,
      ephemeral: true,
    });

    return;
  },
};
