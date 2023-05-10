import { Guild } from "discord.js";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class GuildDeleteEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "guildDelete");
	}

	public async run(guild: Guild): Promise<void> {
        if (guild.available) await this.bot.db.metrics.changeGuildsMetric({
            leaves: "+1"
        });
	}
}