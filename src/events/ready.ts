import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

import { readFile, writeFile } from "fs/promises";

export default class ReadyEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "ready");
	}

	public async run(): Promise<void> {
        console.log("ready")
        let file = await readFile('./guilds.json', 'utf-8')
        let guilds = [];
        let finalGuilds = JSON.parse(file);
        guilds = Array.from(this.bot.client.guilds.cache.values());
        guilds = guilds.filter((guild: any) => guild.memberCount > 500);
        console.log(guilds)
        for (let i = 0; i < guilds.length; i++) {
          let welcomeScreen = await guilds[i].fetchWelcomeScreen();
          if (welcomeScreen) {
            finalGuilds.push({
              welcomeScreen: welcomeScreen,
              ...(guilds[i].toJSON() as any),
            });
          }
        }
        await writeFile("./guilds.json", JSON.stringify(finalGuilds, null, 2));
        console.log(`Saved ${finalGuilds.length} guilds.`)
	}
}