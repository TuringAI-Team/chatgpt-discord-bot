import {
  SlashCommandBuilder,
  EmbedBuilder,
  AttachmentBuilder,
} from "discord.js";
import { chat } from "../modules/gpt-api.js";
import supabase from "../modules/supabase.js";
import { useToken } from "../modules/loadbalancer.js";
import { isPremium } from "../modules/premium.js";
import delay from "delay";
import {
  AudioPlayer,
  createAudioResource,
  StreamType,
  entersState,
  VoiceConnectionStatus,
  joinVoiceChannel,
} from "@discordjs/voice";
import discordTTS from "discord-tts";
import cld from "cld";
import CountryLanguage from "@ladjs/country-language";
import { voiceAudio, Elevenlabs } from "../modules/voice.js";

export default {
  cooldown: "2m",
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Chat with an AI using your voice")
    .addSubcommand((subcommand) =>
      subcommand
        .setName("manual")
        .setDescription("Start a voice chat with an AI manually")
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("The model you want to use for the AI.")
            .setRequired(false)
            .addChoices(
              { name: "GPT-3", value: "gpt-3" },
              { name: "ChatGPT(gpt-3.5)", value: "chatgpt" }
            )
        )
    ),
  /* .addSubcommand((subcommand) =>
      subcommand
        .setName("auto")
        .setDescription(
          "Start a voice chat with an AI automatically when you say gpt + text"
        )
        .addStringOption((option) =>
          option
            .setName("model")
            .setDescription("The model you want to use for the AI.")
            .setRequired(false)
            .addChoices(
              { name: "GPT-3", value: "gpt-3" },
              { name: "ChatGPT(gpt-3.5)", value: "chatgpt" }
            )
        )
    )*/ async execute(interaction, client, commands, commandType, options) {
    let guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    /*let ispremium = await isPremium(interaction.user.id, guildId);
    if (!ispremium) {
      await commandType.reply(interaction, {
        content:
          "This command is premium only since is in a test phase, to get premium use the command `/premium buy`",
        ephemeral: true,
      });
      return;
    }*/
    let model = interaction.options.getString("model");
    if (!model) model = "chatgpt";
    let listen = false;
    if (interaction.options.getSubcommand() == "auto") {
      let ispremium = await isPremium(interaction.user.id, guildId);
      if (!ispremium) {
        await commandType.reply(interaction, {
          content:
            "This feature(`/voice auto`) is premium only since is in a test phase, to get premium use the command `/premium buy`",
          ephemeral: true,
        });
        return;
      }
      listen = true;
    }

    await voiceAudio(interaction, client, commandType, model, listen);
  },
};
