import { Message } from "discord.js";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class MessageCreateEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "messageCreate");
	}

	public async run(message: Message): Promise<void> {
		try {
			/* Pass over the message to Generator#handle(). */
			await this.bot.conversation.generator.handle({
				message,
				content: message.content,
				author: message.author
			});
			
		} catch (error) {
			/* Stub */
		}
	}
}