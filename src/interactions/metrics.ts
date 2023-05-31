import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import MetricsCommand from "../commands/dev/metrics.js";
import { Bot } from "../bot/bot.js";

export class MetricsInteractionHandler extends InteractionHandler<ButtonInteraction> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("midjourney")
                .setDescription("Metrics viewer actions (page switching, changing time frame, etc.)")
                .setType([ InteractionType.Button ])
        );
    }

    public async run({ raw, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction>): InteractionHandlerResponse {
        return this.bot.command.get<MetricsCommand>("metrics").handleInteraction(interaction, db, raw);
    }
}