import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class SupportCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("support")
			.setDescription("View support details for the bot")
		, { always: true });
	}

    public async run(): CommandResponse {
		const fields = [
			{
				key: "Discord server ✨",
				value: `Feel free to ask your questions and give us feedback on our **[support server](${Utils.supportInvite(this.bot)})**.`
			},

			{
				key: "Donations 💰",
				value: `The bot is constantly growing; ***and so are the costs***. In order to keep the bot running for free, we would appreciate a small *donation* in the form of a [**Premium** subscription](${Utils.shopURL()})! 💕`
			}
		]

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Support")
			.setDescription("*You have questions about the bot or want to give feedback?*")
			.setColor(this.bot.branding.color)

			.addFields(fields.map(({ key, value }) => ({
				name: key, value
			})));

        return new Response().addEmbed(builder);
    }
}