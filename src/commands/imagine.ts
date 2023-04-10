import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from "discord.js";
import "dotenv/config";
import supabase from "../modules/supabase.js";
import {
  checkGeneration,
  generateImg,
  generateImg2img,
  generateVariationRow,
  png2webp,
  ImagineInteraction,
} from "../modules/stablehorde.js";
import { isPremium } from "../modules/premium.js";

import sharp from "sharp";
import { generateRateRow, generateUpscaleRow } from "../modules/stablehorde.js";
var maintenance = true;

var data = new SlashCommandBuilder()
  .setName("imagine")
  .setDescription("Generate an image using open joruney.")
  .addStringOption((option) =>
    option
      .setName("prompt")
      .setDescription("The prompt for generating an image")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("style")
      .setDescription("The style of the image")
      .setRequired(true)
      .addChoices(
        // anime, realistic, paintart,
        { name: "Auto select using AI(premium only)", value: "auto" },
        { name: "Anime", value: "anime" },
        { name: "Realistic", value: "realistic" },
        { name: "Paintart", value: "paintart" },
        { name: "Pixel Art", value: "pixelart" },
        { name: "Futuristic", value: "futuristic" },
        { name: "Microworld", value: "microworld" },
        { name: "T-Shirt", value: "tshirt" },
        { name: "Logo", value: "logo" },
        { name: "GTA 5 Art", value: "gta5" },
        { name: "Funko Pop", value: "funko" },
        { name: "Other", value: "other" }
      )
  );
export default {
  cooldown: "3m",
  data,
  disablePing: true,
  async execute(interaction, client) {
    try {
      await interaction.deferReply({
        ephemeral: true,
      });
    } catch (err) {
      console.log(err);
    }
    var tags = [];

    var style = interaction.options.getString("style");
    var prompt = interaction.options.getString("prompt");
    // if style is auto say is premium because of testing
    if (
      //      style == "auto" &&
      !(await isPremium(interaction.user.id, interaction.guild.id))
    ) {
      interaction.editReply({
        content:
          "This feature is only available for premium users for testing/security reasons, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }

    await ImagineInteraction(interaction, client, style, prompt);
  },
};
