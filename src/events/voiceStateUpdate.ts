import { Events, ActivityType } from "discord.js";
import chalk from "chalk";
import { resetto0 } from "../modules/loadbalancer.js";
import ms from "ms";
import supabase from "../modules/supabase.js";
import { getVoiceConnection } from "@discordjs/voice";

export default {
  name: Events.VoiceStateUpdate,
  once: false,
  async execute(oldState, newState, client) {
    if (getVoiceConnection(oldState.guild.id)) {
      let voiceConnection = getVoiceConnection(oldState.guild.id);
      let channel = client.channels.cache.get(
        voiceConnection.joinConfig.channelId
      );
      if (channel) {
        if (channel.members.size > 1) return;
        if (channel.members.has(client.user.id)) {
          const index = client.guildsVoice.indexOf(oldState.guildId);
          if (index > -1) {
            // only splice array when item is found
            client.guildsVoice.splice(index, 1); // 2nd parameter means remove one item only
          }
          voiceConnection!.destroy();
        }
      }
    }
  },
};
