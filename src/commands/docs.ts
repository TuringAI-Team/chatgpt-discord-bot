import { SlashCommandBuilder } from "discord.js";

import { IntroductionPage, IntroductionPages, buildIntroductionPage, introductionPageAt } from "../util/introduction.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Bot } from "../bot/bot.js";

interface DocumentationCommandOptions {
	/* Name of the command itself */
	name: string;

	/* Which page to display */
	page: IntroductionPage;
}

export default class DocumentationCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("docs")
			.setDescription("Look at various documentation & information about the bot")
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
		const page: IntroductionPage = introductionPageAt(interaction.options.getInteger("page") ?? 0);
		return buildIntroductionPage(this.bot, interaction.user, page);
    }
}

class BaseDocumentationCommand extends Command {
	/* Which page to display */
	private readonly page: IntroductionPage;

	constructor(bot: Bot, { name, page }: DocumentationCommandOptions) {
		super(bot, new SlashCommandBuilder()
			.setName(name)
			.setDescription(page.design.description)
		, { always: true });

		this.page = page;
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		return buildIntroductionPage(this.bot, interaction.user, this.page, true);
    }
}