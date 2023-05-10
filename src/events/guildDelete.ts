import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class GuildDeleteEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "guildDelete");
	}

	public async run(): Promise<void> {
        await this.bot.db.metrics.changeGuildsMetric({
            joins: "-1"
        });
	}
}