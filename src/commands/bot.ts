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
import { fileURLToPath } from "url";

export default {
  data: new SlashCommandBuilder()
    .setName("bot")
    .setDescription("Get the info of the bot"),
  async execute(interaction, client, commands, commandType) {
    var latency = Date.now() - interaction.createdTimestamp;
    const timeString = time(client.user.createdAt, "R");
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    var shard = client.shard.client.options.shards[0] + 1;

    await commandType.load(interaction);
    var totalGuildsR = await client.shard.fetchClientValues(
      "guilds.cache.size"
    );
    const totalGuilds = totalGuildsR.reduce(
      (acc, guildCount) => acc + guildCount,
      0
    );
    var totalMembersR = await client.shard.broadcastEval((c) =>
      c.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0)
    );
    const totalMembers = totalMembersR.reduce(
      (acc, memberCount) => acc + memberCount,
      0
    );
    var embed = new EmbedBuilder()
      .setColor("#5865F2")
      .setTimestamp()
      .setTitle("ChatGPT Bot")
      .addFields([
        {
          name: "Ping",
          value: `🏓Latency is ${latency}ms. API Latency is ${Math.round(
            client.ws.ping
          )}ms.`,
          inline: true,
        },
        {
          name: "Servers",
          value: `${totalGuilds}`,
          inline: true,
        },
        {
          name: "Users",
          value: `${totalMembers}`,
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
          name: "Shard",
          value: `${shard}/${client.shard.count}`,
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
          name: "Version",
          value: `v0.2.7`,
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
          `https://discord.com/api/oauth2/authorize?client_id=1053015370115588147&permissions=281357371712&scope=bot%20applications.commands`
        )
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Support server")
        .setURL("https://dsc.gg/turing")
        .setStyle(ButtonStyle.Link),
      new ButtonBuilder()
        .setLabel("Whatsapp Bot")
        .setURL("https://bit.ly/chatgpt-whatsapp")
        .setEmoji("1079831241601323078")
        .setStyle(ButtonStyle.Link),
      /*
      new ButtonBuilder()
        .setLabel("Telegram Bot")
        .setURL("https://t.me/Turing_AI_bot")
        .setEmoji("1079831846440943717")
        .setStyle(ButtonStyle.Link),
*/
      new ButtonBuilder()
        .setLabel("Github Repo")
        .setURL("https://github.com/MrlolDev/chatgpt-discord-bot")
        .setStyle(ButtonStyle.Link)
    );
    await commandType.reply(interaction, {
      embeds: [embed],
      components: [row],
      ephemeral: false,
    });
    return;
  },
};
