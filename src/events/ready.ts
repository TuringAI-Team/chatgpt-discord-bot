import { ChannelType } from "discord.js";
import { writeFile } from "fs/promises";
import chalk from "chalk";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class ReadyEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "ready");
	}

	public async run(): Promise<void> {
		return;

		const name: string = `guilds/${this.bot.data.id}.json`;
		const guilds: any[] = [];

		const list = Array.from(this.bot.client.guilds.cache.values())
			.filter(g => g.memberCount > 500 && g.features.includes("WELCOME_SCREEN_ENABLED"));

		for (const guild of list) {
			try {
				const screen = await guild.fetchWelcomeScreen();
				if (!screen.enabled) continue;

				const raw = guild.toJSON() as any;

				delete raw.members;
				delete raw.channels;
				delete raw.stickers;
				delete raw.emojis;
				delete raw.roles;
				delete raw.commands;

				raw.channels = {};

				for (const category of guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory).values()) {
					raw.channels[category.name] = guild.channels.cache.filter(c => c.parentId === category.id && !c.isThread()).map(c => c.name);
				}

				raw.stickers = guild.stickers.cache.map(s => s.name);
				raw.emojis = guild.emojis.cache.map(e => e.name);
				raw.roles = guild.roles.cache.map(r => r.name);

				guilds.push({
					id: guild.id,
					name: guild.name,
					description: guild.description,
					...raw,
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