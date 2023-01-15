import {
  ActionRowBuilder,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  time,
  ButtonStyle,
} from "discord.js";
import fs from "node:fs";
import path from "node:path";
import { getActiveTokens } from "../modules/loadbalancer.js";
import { fileURLToPath } from "url";

export default {
  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Get the info of the bot"),
  async execute(interaction, client) {
    const timeString = time(client.user.createdAt, "R");

    var usersCount = 0;
    var users = client.guilds.cache.map((guild) => guild.memberCount);
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    var tokens = await getActiveTokens();
    for (var i = 0; i < users.length; i++) {
      usersCount += users[i];
    }
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
          value: `${usersCount}`,
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
          name: "ChatGPT Tokens",
          value: `${tokens}`,
          inline: true,
        },
        {
          name: "Version",
          value: `v0.1.6`,
          inline: true,
        },
      ])
      .setFooter({
        text: "This is not an official bot.",
      });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Add me")
        .setURL(
          `https://discord.com/api/oauth2/authorize?client_id=1053015370115588147&permissions=277025736768&scope=bot%20applications.commands`
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Support server")
        .setURL("https://dsc.gg/turing")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Github Repo")
        .setURL("https://github.com/MrlolDev/chatgpt-discord-bot")
        .setStyle(ButtonStyle.Link)
    );
    await interaction.reply({
      embeds: [embed],
      components: [row],
    });
    return;
  },
};
