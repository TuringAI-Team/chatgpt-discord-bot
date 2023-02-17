import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
  data: {
    customId: "reset",
    description: "Reset your conversation",
  },
  async execute(interaction, client, conversationId) {
    var conversationOwner = conversationId.split("-")[1];
    if (interaction.user.id != conversationOwner) {
      await interaction.reply({
        content: "You can't reset this conversation",
        ephemeral: true,
      });
      return;
    }
    var { data: conversation, error } = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .single();
    if (error) {
      await interaction.reply({
        content: "Error connecting with db",
        ephemeral: true,
      });
      return;
    }
    if (!conversation) {
      await interaction.reply({
        content: "Conversation not found",
        ephemeral: true,
      });
      return;
    }
    try {
      await supabase.from("conversations").delete().eq("id", conversationId);
      await interaction.reply({
        content: "Conversation reseted",
        ephemeral: true,
      });
    } catch (err) {
      await interaction.reply({
        content: "Error connecting with db",
        ephemeral: true,
      });
      return;
    }
  },
};
