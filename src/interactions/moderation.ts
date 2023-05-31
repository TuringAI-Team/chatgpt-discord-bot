import { ButtonInteraction, CacheType, StringSelectMenuInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { ModerationToolbarAction } from "../moderation/moderation.js";
import { Bot } from "../bot/bot.js";

export interface ModerationInteractionHandlerData {
    /* Which action to perform */
    action: ModerationToolbarAction;

    /* ID of the user to take this action for, optional */
    id: string;

    /* Additional action for the quick action menus */
    quickAction: "ban" | "warn" | null;
}

export class ModerationInteractionHandler extends InteractionHandler<ButtonInteraction | StringSelectMenuInteraction, ModerationInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("mod")
                .setDescription("Various moderation actions")
                .setType([ InteractionType.Button, InteractionType.StringSelectMenu ]),

            {
                action: "string",
                id: "string",
                quickAction: "any"
            },

            {
                restriction: [ "owner", "moderator" ]
            }
        );
    }

    public async run({ data, interaction }: InteractionHandlerRunOptions<ButtonInteraction | StringSelectMenuInteraction, ModerationInteractionHandlerData>): InteractionHandlerResponse {
        return this.bot.moderation.handleInteraction(interaction, data);
    }
}