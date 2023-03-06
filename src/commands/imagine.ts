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
var maintenance = false;

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
  async execute(interaction, client) {
    if (!interaction.deferred && !interaction.replied)
      await interaction.deferReply();
    if (maintenance == true && interaction.user.id != "530102778408861706") {
      await interaction.reply({
        content:
          "Service under maintenance, for more information join us on [dsc.gg/turing](https://dsc.gg/turing)",
        ephemeral: true,
      });
      return;
    }
    var tags = [];

    var style = interaction.options.getString("style");
    var prompt = interaction.options.getString("prompt");
    // if style is auto say is premium because of testing
    if (
      style == "auto" &&
      !(await isPremium(interaction.user.id, interaction.guild.id))
    ) {
      interaction.editReply({
        content:
          "This feature is only available for premium users for testing reasons, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }

    await ImagineInteraction(interaction, client, style, prompt);
  },
};
