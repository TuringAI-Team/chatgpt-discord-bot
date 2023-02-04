import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { voiceAudio } from "../modules/voice.js";

export default {
  data: {
    customId: "chat-vc",
    description: "Chat with the bot in a voice channel",
  },
  async execute(interaction, client) {
    await voiceAudio(interaction, client, interactionType);
  },
};

const interactionType = {
  type: "interaction",
  load: async (interaction) => {
    await interaction.deferReply();
  },
  reply: async (interaction, content) => {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content);
    } else {
      await interaction.reply(content);
    }
  },
};
