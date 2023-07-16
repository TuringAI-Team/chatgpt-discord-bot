import { ButtonInteraction } from "discord.js";

import { InteractionHandler, InteractionHandlerBuilder, InteractionHandlerResponse, InteractionHandlerRunOptions, InteractionType } from "../interaction/handler.js";
import { DatasetName } from "../turing/dataset.js";
import { Bot } from "../bot/bot.js";

type DatasetInteractionAction = "rate"

export interface DatasetInteractionHandlerData {
    /* Which action to perform */
    action: DatasetInteractionAction;

    /* Name of the dataset */
    dataset: DatasetName;

    /* ID of the interaction */
    id: string;

    /* Additional data */
    rating: number;
}

export class GeneralInteractionHandler extends InteractionHandler<ButtonInteraction, DatasetInteractionHandlerData> {
    constructor(bot: Bot) {
        super(
            bot,
            
            new InteractionHandlerBuilder()
                .setName("dataset")
                .setDescription("Various useful interaction options")
                .setType([ InteractionType.Button ]),

            {
                action: "string",
                dataset: "string",
                id: "string",
                rating: "number"
            }
        );
    }

    public async run(options: InteractionHandlerRunOptions<ButtonInteraction, DatasetInteractionHandlerData>): InteractionHandlerResponse {
        const { interaction } = options;
        
        const name: string | null = interaction.message.interaction && interaction.message.interaction.user.id !== this.bot.client.user.id
            ? interaction.message.interaction.user.username
            : interaction.message.embeds[0] && interaction.message.embeds[0].title && interaction.message.embeds[0].title.includes("@")
                ? interaction.message.embeds[0].title.split("@")[1]?.replaceAll("🔎", "").trim() ?? null
                : null;

        if (name === null || name !== interaction.user.username) return void await interaction.deferUpdate();
        return this.bot.turing.dataset.handleInteraction(options);
    }
}