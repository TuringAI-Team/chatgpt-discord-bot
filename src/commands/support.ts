import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

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
				key: "Ask the owner 🫂",
				value: `Don't be shy; if you have questions about the bot, you can ask **\`f1nniboy#2806\`** directly in his DMs.`
			},

			{
				key: "Donations 💰",
				value: `The bot is constantly growing; ***and so are the costs***. In order to keep the bot running for free, we would appreciate a small *donation* in the form of a [**Premium** subscription](${Utils.shopURL()})! 💕`
			}
		]

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Support")
			.setDescription("*You have questions about the bot or want to appeal your ban?*")
			.setColor(this.bot.branding.color)

			.addFields(fields.map(({ key, value }) => ({
				name: key, value
			})));

        return new Response().addEmbed(builder);
    }
}