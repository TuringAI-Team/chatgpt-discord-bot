import { ApplicationCommandType, ContextMenuCommandBuilder, ContextMenuCommandInteraction } from "discord.js";

import { Command, CommandOptions } from "../command.js";
import { Bot } from "../../bot/bot.js";

export class ContextMenuCommand extends Command<ContextMenuCommandInteraction> {
    constructor(bot: Bot, builder: ContextMenuCommandBuilder, options?: CommandOptions) {
        builder.setType(ApplicationCommandType.Message);
        super(bot, builder, options);
    }
}