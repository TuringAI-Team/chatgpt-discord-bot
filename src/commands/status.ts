import { SlashCommandBuilder } from "discord.js";

import { Bot, BotStatus, BotStatusTypeColorMap, BotStatusTypeEmojiMap, BotStatusTypeTitleMap } from "../bot/bot.js";
import { Command, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

export default class StatusCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("status")
			.setDescription("View the status of OpenAI services & the bot")
		, { long: true, always: true });
	}

    public async run(): CommandResponse {
		/* Status of the bot */
		const status: BotStatus = await this.bot.status();

		const response: Response = new Response()
			.addEmbed(builder => builder
				.setTitle("Status 🧐")
				.setDescription("*Status of the Discord bot*")
				.addFields({
					name: `${BotStatusTypeTitleMap[status.type]} ${BotStatusTypeEmojiMap[status.type]}`,
					value: `${status.notice ? `*${status.notice}* — ` : ""}<t:${Math.floor(status.since / 1000)}:f>`
				})
				.setColor(BotStatusTypeColorMap[status.type] ?? "White")
			);

        return response;
    }
}