import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Bot } from "../bot/bot.js";

type CampaignInteractionAction = "link"

export interface CampaignInteractionHandlerData {
    /* Which action to perform */
    action: CampaignInteractionAction;
}

export class ChatInteractionHandler extends InteractionHandler<ButtonInteraction, CampaignInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("campaign")
                .setDescription("Various actions regarding the campaign feature")
                .setType([ InteractionType.Button, InteractionType.StringSelectMenu ]),

            {
                action: "string"
            }
        );
    }

    public async run(data: InteractionHandlerRunOptions<ButtonInteraction, CampaignInteractionHandlerData>): InteractionHandlerResponse {
        return this.bot.db.campaign.handleInteraction(data);
    }
}