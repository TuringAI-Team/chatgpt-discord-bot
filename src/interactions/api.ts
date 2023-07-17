import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import APICommand from "../commands/api.js";
import { Bot } from "../bot/bot.js";

type APIInteractionAction = "continue"

export interface APIInteractionHandlerData {
    /* Which action to perform */
    action: APIInteractionAction;
}

export class APIInteractionHandler extends InteractionHandler<ButtonInteraction, APIInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("api")
                .setDescription("Various actions regarding /api")
                .setType([ InteractionType.Button ]),

            {
                action: "string"
            }
        );
    }

    public async run(data: InteractionHandlerRunOptions<ButtonInteraction, APIInteractionHandlerData>): InteractionHandlerResponse {
        return this.bot.command.get<APICommand>("api").handleInteraction(data);
    }
}