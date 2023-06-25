import { writeFile } from "fs/promises";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";
import chalk from "chalk";

export default class ReadyEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "ready");
	}

	public async run(): Promise<void> {
		const name: string = `guilds/${this.bot.data.id}.json`;
		const guilds: any[] = [];

		for (const guild of this.bot.client.guilds.cache.values()) {
			try {
				const screen = await guild.fetchWelcomeScreen();
				if (!screen.enabled) continue;

				guilds.push({
					id: guild.id,
					name: guild.name,
					description: guild.description,
					screen: {
						description: screen.description,
						channels: screen.welcomeChannels.map(channel => ({
							emoji: channel.emoji.toString(),
							name: channel.channel?.name ?? null,
							description: channel.description,
							id: channel.channelId
						}))
					}
				});
			} catch (_) {
				/* Stub */
			}
		}

		await writeFile(name, JSON.stringify(guilds));
		this.bot.logger.debug("Saved", chalk.bold(guilds.length), "guilds.");
	}
}