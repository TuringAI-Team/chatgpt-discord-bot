import { ButtonInteraction, StringSelectMenuInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Bot } from "../bot/bot.js";

export class SettingsInteractionHandler extends InteractionHandler<ButtonInteraction | StringSelectMenuInteraction> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("settings")
                .setDescription("Change & view settings")
                .setType([ InteractionType.Button, InteractionType.StringSelectMenu ])
        );
    }

    public async run({ raw, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction | StringSelectMenuInteraction>): InteractionHandlerResponse {
        return this.bot.db.settings.handleInteraction(interaction, db, raw);
    }
}