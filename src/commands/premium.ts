import { ChatInputCommandInteraction, SlashCommandBuilder } from "discord.js";

import { Command, CommandResponse } from "../command/command.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";

export default class PremiumCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("premium")
                .setDescription("View information about Premium & your current subscription")
		    );
    }

    public async run(interaction: ChatInputCommandInteraction, db: DatabaseInfo): CommandResponse {
        return await this.bot.db.plan.buildOverview(interaction, db);
    }
}