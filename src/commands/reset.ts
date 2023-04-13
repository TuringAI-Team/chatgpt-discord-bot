import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonStyle,
  ButtonBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { useToken } from "../modules/loadbalancer.js";
import { isPremium } from "../modules/premium.js";
var maintenance = false;
import { ImagineInteraction } from "../modules/stablehorde.js";
import delay from "delay";
import {
  checkInCache,
  saveInCache,
  addUsesInCache,
} from "../modules/cache-responses.js";

export default {
  cooldown: null,
  disablePing: null,
  data: new SlashCommandBuilder()
    .setName("reset")
    .setDescription("Reset your conversation with the AI")
    .addStringOption((option) =>
      option
        .setName("model")
        .setDescription("The model you want to use for the AI.")
        .setRequired(false)
        .addChoices(
          //  { name: "Alan(gpt-4)", value: "alan" },
          { name: "ChatGPT(gpt-3.5)", value: "chatgpt" },
          //{ name: "Clyde(gpt-3.5)", value: "clyde" },
          //{ name: "DAN(gpt-3.5)", value: "dan" },
          { name: "GPT-4(Premium only)", value: "gpt4" },
          { name: "GPT-3", value: "gpt3" },
          {
            name: "Open Assistant(oasst-sft-1-pythia-12b)",
            value: "oasst-sft-1-pythia-12b",
          }
        )
    ),
  async execute(interaction, client, commands, commandType, options) {
    await commandType.load(interaction);
    let model = interaction.options.getString("model");
    if (!model) {
      if (options) {
        model = options.model;
      } else {
        model = interaction.user.model;
      }
    }
    console.log(model);
    let conversationId = `${model}-${interaction.user.id}`;
    var { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    if (error) {
      await interaction.editReply({
        content: "Error connecting with db/Conversation not found",
        ephemeral: true,
      });
      return;
    }
    if (!conversation) {
      await interaction.editReply({
        content: "Conversation not found",
        ephemeral: true,
      });
      return;
    }
    try {
      await supabase.from("conversations").delete().eq("id", conversationId);
      await interaction.editReply({
        content: `Conversation has been reset for model ${model}`,
        ephemeral: true,
      });
    } catch (err) {
      console.log(err);
      await interaction.editReply({
        content: "Error connecting with db",
        ephemeral: true,
      });
      return;
    }
  },
};
