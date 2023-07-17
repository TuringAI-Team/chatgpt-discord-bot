import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { Bot } from "../bot/bot.js";

type ChatInteractionAction = "continue"

export interface ChatInteractionHandlerData {
    /* Which action to perform */
    action: ChatInteractionAction;

    /* Original author, the only user who can perform this action */
    id: string | null;
}

export class ChatInteractionHandler extends InteractionHandler<ButtonInteraction, ChatInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("chat")
                .setDescription("Various actions regarding the chat feature")
                .setType([ InteractionType.Button ]),

            {
                action: "string",
                id: "string?"
            }
        );
    }

    public async run(data: InteractionHandlerRunOptions<ButtonInteraction, ChatInteractionHandlerData>): InteractionHandlerResponse {
        if (data.data.id !== null && data.db.user.id !== data.data.id) return void await data.interaction.deferUpdate();
        return this.bot.conversation.generator.handleInteraction(data);
    }
}