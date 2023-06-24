import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Bot } from "../bot/bot.js";

type CampaignInteractionAction = "link"

export interface CampaignInteractionHandlerData {
    /* Which action to perform */
    action: CampaignInteractionAction;

    /* ID of the campaign */
    id: string;
}

export class ChatInteractionHandler extends InteractionHandler<ButtonInteraction, CampaignInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("campaign")
                .setDescription("Various actions regarding the campaign feature")
                .setType([ InteractionType.Button ]),

            {
                id: "string",
                action: "string"
            }
        );
    }

    public async run(data: InteractionHandlerRunOptions<ButtonInteraction, CampaignInteractionHandlerData>): InteractionHandlerResponse {
        return await this.bot.db.campaign.handleInteraction(data);
    }
}