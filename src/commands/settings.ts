import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { SettingCategories, SettingsCategory } from "../db/managers/settings.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Emoji } from "../util/emoji.js";
import { Bot } from "../bot/bot.js";

export default class SettingsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("settings")
			.setDescription("Customize the bot to your liking")
			.addStringOption(builder => builder
				.setName("category")
				.setDescription("Which category to view")
				.addChoices(...SettingCategories.map(c => ({
					name: `${c.name} ${Emoji.display(c.emoji)}`,
					value: c.type
				})))
			)
		);
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Name of the category to view, optional */
		const categoryName: string | null = interaction.options.getString("category", false);

		const category: SettingsCategory = categoryName !== null
			? this.bot.db.settings.categories().find(c => c.type === categoryName)!
			: this.bot.db.settings.categories()[0];

		return this.bot.db.settings.buildPage({
			db, category
		});
    }
}