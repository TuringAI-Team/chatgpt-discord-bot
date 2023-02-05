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
    if (getVoiceConnection(interaction.guildId)) {
      var voiceConnection = getVoiceConnection(interaction.guildId);

      var channel = client.channels.cache.get(
        voiceConnection.joinConfig.channelId
      );
      if (channel.members.has(interaction.user.id)) {
        getVoiceConnection(interaction.guildId).disconnect();
        const index = client.guildsVoice.indexOf(interaction.guildId);
        if (index > -1) {
          // only splice array when item is found
          client.guildsVoice.splice(index, 1); // 2nd parameter means remove one item only
        }
        await interaction.reply({
          content: "ChatGPT voice off",
          components: [],
          embeds: [],
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content:
            "You are not connnected to the same voice channel as the bot.",
          components: [],
          embeds: [],
          ephemeral: true,
        });
      }
    } else {
      await interaction.reply({
        content: "No voice connection was found to this discord channel",
        components: [],
        embeds: [],
        ephemeral: true,
      });
    }
  },
};
