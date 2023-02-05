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
    .setDescription("Chat with an AI using your voice"),
  async execute(interaction, client, commands, commandType, options) {
    await voiceAudio(interaction, client, commandType);
  },
};
