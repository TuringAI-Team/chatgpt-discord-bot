import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import ImagineCommand from "../commands/imagine.js";
import { Bot } from "../bot/bot.js";

type ImagineInteractionAction = "view" | "cancel"

export interface ImagineInteractionHandlerData {
    /* Which action to perform */
    action: ImagineInteractionAction;

    /* ID of the user who invoked this interaction */
    id: string;

    /* ID of the entire image results */
    imageID: string;

    /* ID of the single image result, optional */
    resultID: string | null;
}

export class ImagineInteractionHandler extends InteractionHandler<ButtonInteraction, ImagineInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("i")
                .setDescription("/imagine actions (upscaling, rating, etc.)")
                .setType([ InteractionType.Button ]),

            {
                action: "string",
                id: "string",
                imageID: "string",
                resultID: "any"
            }
        );
    }

    public async run({ data, interaction, db }: InteractionHandlerRunOptions<ButtonInteraction, ImagineInteractionHandlerData>): InteractionHandlerResponse {
        return this.bot.command.get<ImagineCommand>("imagine").handleButtonInteraction(interaction, db, data);
    }
}