import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";

export default class SettingsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("settings")
			.setDescription("Customize the bot to your liking")
		);
    }

    public async run(_: CommandInteraction, db: DatabaseInfo): CommandResponse {
		return this.bot.db.settings.buildPage({
			db, current: db.user.settings, category: this.bot.db.settings.categories()[0]
		});
    }
}