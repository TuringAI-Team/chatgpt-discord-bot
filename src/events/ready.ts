import { Events, ActivityType } from "discord.js";
import chalk from "chalk";
import { resetto0, checkLimited } from "../modules/loadbalancer.js";
import ms from "ms";
import supabase from "../modules/supabase.js";
import chatGPT from "chatgpt-io";

export default {
  name: Events.ClientReady,
  once: true,
  async execute(client) {
    await resetto0();
    client.user.setPresence({
      activities: [
        { name: `v0.2.7 | dsc.gg/turing`, type: ActivityType.Playing },
      ],
      status: "online",
    });

    //const { data, error } = await supabase.from("conversations").delete();
    console.log(
      chalk.white(`Ready! Logged in as `) + chalk.blue.bold(client.user.tag)
    );
    if (client.shard.client.options.shards[0] + 1 == 1) {
      await checkLimited();
      setInterval(async () => {
        await checkLimited();
      }, ms("2m"));
    }

    /*
    const { data: tokens } = await supabase
      .from("accounts")
      .select("*")
      .neq("access", null);

    for (const sessionToken of tokens) {
      console.log(`testing ${sessionToken.id}`);
      let bot = new chatGPT(sessionToken.access);
      let response = await bot.ask("Hello?");
      console.log(sessionToken.id, response);
    }
    console.log(`tests finished`);
    */
  },
};
