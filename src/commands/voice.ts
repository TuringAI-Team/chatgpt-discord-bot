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
import { voiceAudio } from "../modules/voice.js";

export default {
  cooldown: "2m",
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("Chat with an AI using your voice"),
  async execute(interaction, client, commands, commandType, options) {
    var ispremium = await isPremium(interaction.user.id);
    if (ispremium) {
      await voiceAudio(interaction, client, commandType);
    } else {
      await commandType.reply(interaction, {
        content:
          "This feature is only available for premium users, right now. If you want to donate  to get premium use the command " +
          "`/premium buy` .",
        ephemeral: true,
      });
    }
  },
};
