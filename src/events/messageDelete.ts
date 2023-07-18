import { Message, PartialMessage } from "discord.js";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class MessageDeleteEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "messageDelete");
	}

	public async run(message: Message | PartialMessage): Promise<void> {
		if (!message.partial) await this.bot.conversation.generator.handleDeletion(message);
	}
}