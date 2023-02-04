import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
  data: {
    customId: "leave-vc",
    description: "Make the bot leave a voice channel",
  },
  async execute(interaction, client) {
    if (
      getVoiceConnection(interaction.guildId) &&
      interaction.member.voice.channelId
    ) {
      getVoiceConnection(interaction.guildId).disconnect();
      await interaction.update({
        content: "ChatGPT voice off",
        components: [],
        embeds: [],
      });
    } else {
      await interaction.update({
        content: "No voice connection was found to this discord channel",
        components: [],
        embeds: [],
      });
    }
  },
};
