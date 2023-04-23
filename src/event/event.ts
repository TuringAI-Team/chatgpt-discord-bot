import { ClientEvents } from "discord.js";
import { Bot } from "../bot/bot.js";

export class Event {
	public readonly name: string;
	protected readonly bot: Bot;

	constructor(bot: Bot, name: keyof ClientEvents) {
		this.name = name;
		this.bot = bot;
	}

	/* Function to execute when the event has been emitted */
	public run(...args: any[]): void {
		/* Stub */
	}
}