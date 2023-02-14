import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from "discord.js";
import supabase from "../modules/supabase.js";
import { voiceAudio } from "../modules/voice.js";
import ms from "ms";
import { isPremium } from "../modules/premium.js";

export default {
  data: {
    customId: "chat-vc",
    description: "Chat with the bot in a voice channel",
  },
  async execute(interaction, client) {
    await interaction.reply("Function under maintenance");
    return;
    var guildId;
    if (interaction.guild) guildId = interaction.guild.id;
    var ispremium = await isPremium(interaction.user.id, guildId);
    if (ispremium) {
      let { data: cooldowns, error } = await supabase
        .from("cooldown")
        .select("*")

        // Filters
        .eq("userId", interaction.user.id)
        .eq("command", "chat-vc");
      if (cooldowns && cooldowns[0]) {
        var cooldown = cooldowns[0];
        var createdAt = new Date(cooldown.created_at);
        var milliseconds = createdAt.getTime();
        var now = Date.now();
        var diff = now - milliseconds;
        // @ts-ignore
        var count = ms("20s") - diff;
        // @ts-ignore
        if (diff >= ms("20s")) {
          const { data, error } = await supabase
            .from("cooldown")
            .update({ created_at: new Date() })
            .eq("userId", interaction.user.id)
            .eq("command", "chat-vc");
          await voiceAudio(interaction, client, interactionType);
        } else {
          await interaction.reply({
            content:
              `Please wait **${ms(
                count
              )}** to use this command again.\nIf you want to **avoid this cooldown** you can **donate to get premium**. If you want to donate use the command ` +
              "`/premium buy` .",
            ephemeral: true,
          });
        }
      } else {
        const { data, error } = await supabase
          .from("cooldown")
          .insert([{ userId: interaction.user.id, command: "chat-vc" }]);
        await voiceAudio(interaction, client, interactionType);
      }
    } else {
      await voiceAudio(interaction, client, interactionType);
    }
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
