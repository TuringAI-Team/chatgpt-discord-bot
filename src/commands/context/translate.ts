import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";

import { ContextMenuCommand } from "../../command/types/context.js";
import { TranslationCooldown } from "../../util/translate.js";
import { CommandResponse } from "../../command/command.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Bot } from "../../bot/bot.js";

export default class TranslateContentContextMenuCommand extends ContextMenuCommand {
	constructor(bot: Bot) {
		super(bot, new ContextMenuCommandBuilder()
			.setName("Translate")
        , {
            cooldown: TranslationCooldown
        });
	}

    public async run(interaction: MessageContextMenuCommandInteraction, db: DatabaseInfo): CommandResponse {
        return this.bot.translation.run({
            content: interaction.targetMessage.content, interaction, db, original: interaction.targetMessage
        });
    }
}