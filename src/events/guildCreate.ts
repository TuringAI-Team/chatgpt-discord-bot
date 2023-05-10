import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class GuildCreateEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "guildCreate");
	}

	public async run(): Promise<void> {
        await this.bot.db.metrics.changeGuildsMetric({
            joins: "+1"
        });
	}
}