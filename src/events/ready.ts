import { Events, ActivityType } from "discord.js";
import chalk from "chalk";
import { resetto0 } from "../modules/loadbalancer.js";
import ms from "ms";
import supabase from "../modules/supabase.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await resetto0();
    client.user.setPresence({
      activities: [
        { name: `v0.2.3 | dsc.gg/turing`, type: ActivityType.Playing },
      ],
      status: "online",
    });

    const { data, error } = await supabase.from("conversations").delete();
    console.log(
      chalk.white(`Ready! Logged in as `) + chalk.blue.bold(client.user.tag)
    );
  },
};
