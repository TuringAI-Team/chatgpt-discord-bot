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
                restriction: [ "voter" ],
                synchronous: true
            }
        );
    }

    public async run({ raw, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction>): InteractionHandlerResponse {
        return this.bot.command.get<MidjourneyCommand>("mj").handleInteraction(this, interaction, db, raw);
    }
}