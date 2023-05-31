import { SlashCommandBuilder } from "discord.js";

import { IntroductionPage, IntroductionPages, Introduction } from "../util/introduction.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Bot } from "../bot/bot.js";

export default class HelpCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("help")
			.setDescription("Look at various help information for the bot")
			.addIntegerOption(builder => builder
				.setName("page")
				.setDescription("Which page to view")
				.setRequired(false)
				.addChoices(...IntroductionPages.map(page => ({
					name: `${page.design.emoji} ${page.design.title} [#${page.index +1}]`,
					value: page.index
				}))))
		, { always: true });
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		const page: IntroductionPage = Introduction.at(interaction.options.getInteger("page") ?? 0);
		return Introduction.buildPage(this.bot, interaction.user, page);
    }
}