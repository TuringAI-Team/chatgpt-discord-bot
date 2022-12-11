import { SlashCommandBuilder, EmbedBuilder, time } from "discord.js";

export default {
  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Get the info of the bot"),
  async execute(interaction, client) {
    const timeString = time(client.user.createdAt, "R");

    var embed = new EmbedBuilder()
      .setColor("#813479")
      .setTimestamp()
      .setTitle("ChatGPT Bot")
      .addFields([
        {
          name: "Ping",
          value: `🏓Latency is ${
            Date.now() - interaction.createdTimestamp
          }ms. API Latency is ${Math.round(client.ws.ping)}ms.`,
          inline: true,
        },
        {
          name: "Servers",
          value: `${client.guilds.cache.size}`,
          inline: true,
        },
        {
          name: "Users",
          value: `${client.users.cache.size}`,
          inline: true,
        },
        {
          name: "Created At",
          value: `${timeString}`,
          inline: true,
        },
        {
          name: "Library",
          value: "Discord.js",
          inline: true,
        },
        {
          name: "RAM Usage",
          value: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(
            2
          )} MB`,
          inline: true,
        },
        {
          name: "Github  repository",
          value: `https://github.com/MrlolDev/chatgpt-bot`,
        },
        {
          name: "Version",
          value: `v0.0.4`,
        },
      ])
      .setFooter({
        text: "This is not an official bot.",
      });
    await interaction.reply({
      embeds: [embed],
    });
    return;
  },
};
