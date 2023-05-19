import { GuildMember, SlashCommandBuilder } from "discord.js";

import { SettingCategories, SettingsCategory, SettingsLocation } from "../db/managers/settings.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Emoji } from "../util/emoji.js";
import { Bot } from "../bot/bot.js";

export default class SettingsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("settings")
			.setDescription("Customize the bot to your liking")
		);
		
		(this.builder as SlashCommandBuilder)
			.addSubcommand(builder => builder
				.setName("user")
				.setDescription("Customize the bot for yourself")
				.addStringOption(builder => builder
					.setName("category")
					.setDescription("Which category to view")
					.addChoices(...this.bot.db.settings.categories(SettingsLocation.User).map(c => ({
						name: `${c.name} ${Emoji.display(c.emoji)}`,
						value: c.type
					})))
				)
			)
			.addSubcommand(builder => builder
				.setName("guild")
				.setDescription("Customize the bot for this entire server")
				.addStringOption(builder => builder
					.setName("category")
					.setDescription("Which category to view")
					.addChoices(...this.bot.db.settings.categories(SettingsLocation.Guild).map(c => ({
						name: `${c.name} ${Emoji.display(c.emoji)}`,
						value: c.type
					})))
				)
			);
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Which settings type to view */
		const type: SettingsLocation = interaction.options.getSubcommand(true) as SettingsLocation;

		if (type === SettingsLocation.Guild && db.guild === null) return new ErrorResponse({
			interaction, message: "You can only view & change guild settings on **servers**", emoji: "😔"
		});

		/* The user's permissions */
		const permissions = interaction.member instanceof GuildMember ? interaction.member.permissions : null;

		if (type === SettingsLocation.Guild && (!permissions || !permissions.has("ManageGuild"))) return new ErrorResponse({
			interaction, message: "You must have the `Manage Server` permission to view & change guild settings", emoji: "😔"
		});

		/* Name of the category to view, optional */
		const categoryName: string | null = interaction.options.getString("category", false);

		const category: SettingsCategory = categoryName !== null
			? this.bot.db.settings.categories(type).find(c => c.type === categoryName)!
			: this.bot.db.settings.categories(type)[0];

		return this.bot.db.settings.buildPage({
			category, db: type === SettingsLocation.Guild ? db.guild! : db.user, interaction
		});
    }
}