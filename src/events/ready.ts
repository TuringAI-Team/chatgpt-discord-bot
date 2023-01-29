import { Events, ActivityType } from "discord.js";
import chalk from "chalk";
import { reloadTokens, resetto0 } from "../modules/loadbalancer.js";
import ms from "ms";
import supabase from "../modules/supabase.js";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await resetto0();
    client.user.setPresence({
      activities: [
        { name: `v0.1.9 | dsc.gg/turing`, type: ActivityType.Playing },
      ],
      status: "online",
    });

    await reloadTokens();
    /*setInterval(async () => {
      await reloadConversations();
    }, ms("1m"));*/
    setInterval(async () => {
      await reloadTokens();
    }, ms("10m"));
    const { data, error } = await supabase.from("conversations").delete();
    console.log(
      chalk.white(`Ready! Logged in as `) + chalk.blue.bold(client.user.tag)
    );
  },
};
