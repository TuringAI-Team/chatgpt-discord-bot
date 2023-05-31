import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Bot } from "../bot/bot.js";

interface PremiumInteractionHandlerData {
    action: "overview";
}

export class PremiumInteractionHandler extends InteractionHandler<ButtonInteraction, PremiumInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("premium")
                .setDescription("View the Premium plan")
                .setType([ InteractionType.Button ]),

            {
                action: "string"
            }
        );
    }

    public async run({ data: { action }, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction, PremiumInteractionHandlerData>): InteractionHandlerResponse {
        if (action === "overview") {
            return this.bot.db.plan.buildOverview(interaction, db);
        }
    }
}