import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { TranslationCooldown } from "../util/translate.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";
import { LanguageManager, UserLanguage, UserLanguages } from "../db/types/locale.js";

const MaxTranslationContentLength: number = 500

export default class TranslateCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("translate")
			.setDescription("Translate a message")

			.addStringOption(builder => builder
				.setName("content")
				.setDescription("Message to translate")
				.setMaxLength(MaxTranslationContentLength)
				.setRequired(true)
			)
			.addStringOption(builder => builder
				.setName("language")
				.setDescription("Language to translate the text into")
				.addChoices(...UserLanguages.map(language => ({
					name: `${language.emoji} ${language.name}`, value: language.id
				})))
			)
		, {
			cooldown: TranslationCooldown
		});
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		const content: string = interaction.options.getString("content", true);

		const languageID: string | null = interaction.options.getString("language", false);

		const language: UserLanguage | undefined = languageID
			? LanguageManager.get(this.bot, languageID) : undefined;

		return this.bot.translation.run({
			content, db, interaction, language
		});
    }
}