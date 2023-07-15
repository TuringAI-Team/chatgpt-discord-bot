import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";

import { ContextMenuCommand } from "../../command/types/context.js";
import { CommandResponse } from "../../command/command.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Bot } from "../../bot/bot.js";

export default class DescribeImageContextMenuCommand extends ContextMenuCommand {
    constructor(bot: Bot) {
        super(bot, new ContextMenuCommandBuilder()
            .setName("Describe image")
        , {
            cooldown: {
                free: 3 * 60 * 1000,
                voter: 2 * 60 * 1000,
                subscription: 30 * 1000
            },

            synchronous: true
        });
    }

    public async run(interaction: MessageContextMenuCommandInteraction, db: DatabaseInfo): CommandResponse {
		return this.bot.description.run(db, interaction);
    }
}