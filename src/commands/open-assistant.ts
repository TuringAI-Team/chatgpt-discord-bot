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
    .setName("open-assistant")
    .setDescription("Help in the data collection of open assistant"),
  async execute(interaction, client, commands, commandType) {
    var embed = new EmbedBuilder()
      .setColor("#3a82f7")
      .setTimestamp()
      .setTitle("Open assistant")
      .setDescription(`Conversational AI for everyone.`)
      .setURL("https://open-assistant.io/?ref=turing")
      .setThumbnail("https://open-assistant.io/images/logos/logo.svg");

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("What is this?")
        .setCustomId("open-assistant_info")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setLabel("Grab a task")
        .setCustomId("open-assistant_tasks")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    );
    await commandType.reply(interaction, {
      embeds: [embed],
      components: [row],
    });
    return;
  },
};
