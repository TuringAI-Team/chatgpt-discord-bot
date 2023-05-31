import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import MidjourneyCommand from "../commands/midjourney.js";
import { Bot } from "../bot/bot.js";

export class MidjourneyInteractionHandler extends InteractionHandler<ButtonInteraction> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("mj")
                .setDescription("Midjourney actions (upscaling, variations, etc.)")
                .setType([ InteractionType.Button ]),

            undefined,

            {
                cooldown: {
                    free: 60 * 1000,
                    voter: 50 * 1000,
                    subscription: 25 * 1000
                }
            }
        );
    }

    public async run({ raw, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction>): InteractionHandlerResponse {
        return this.bot.command.get<MidjourneyCommand>("mj").handleInteraction(interaction, db, raw);
    }
}