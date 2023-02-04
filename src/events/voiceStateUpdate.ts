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
    if (
      client.voiceConnections.find(
        (x) => x.joinConfig.guildId == oldState.guild.id
      )
    ) {
      var voiceConnection = getVoiceConnection(oldState.guild.id);
      var channel = client.channels.cache.get(
        voiceConnection.joinConfig.channelId
      );
      if (channel) {
        if (channel.members.size > 1) return;
        if (channel.members.has(client.user!.id)) {
          voiceConnection!.destroy();
        }
      }
    }
  },
};
