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
import { getUserLang } from "../modules/open-assistant.js";
import {
  langInteraction,
  initInteraction,
  getTranlation,
} from "../interactions/open-assistant.js";

export default {
  data: new SlashCommandBuilder()
    .setName("open-assistant")
    .setDescription("Help in the data collection of open assistant"),
  async execute(interaction, client, commands, commandType) {
    /*await interaction.reply({
      content: `Under development`,
      ephemeral: true,
    });
    return;*/
    var lang = await getUserLang(interaction.user.id);
    await interaction.deferReply();

    if (!lang) {
      await langInteraction(interaction);
    } else {
      var translation = await getTranlation(lang);
      await initInteraction(interaction, translation, lang);
      return;
    }
    /*
     */
  },
};
