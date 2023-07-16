import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle } from "discord.js";
import { randomUUID } from "crypto";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../interaction/handler.js";
import { DatasetInteractionHandlerData } from "../interactions/dataset.js";
import { TuringAPI } from "./api.js";

export type DatasetName = "text" | "image" | "music" | "describe"

interface DatasetToolbarOptions {
    dataset: DatasetName;
    id: string;
    selected?: number;
}

interface DatasetRateOptions {
    dataset: DatasetName;
    id: string;
    rating: number;
}

interface DatasetRateBody {
    dataset: DatasetName;
    id: string;
    rate: number;
}

interface DatasetRateChoice {
    emoji: string;
    value: number;
}

export const DatasetRateChoices: DatasetRateChoice[] = [
    { emoji: "👍", value: 1 },
    { emoji: "👎", value: 0 }
]

export class TuringDatasetManager {
    private readonly api: TuringAPI;

    constructor(api: TuringAPI) {
        this.api = api;
    }

    public async rate({ dataset, id, rating }: DatasetRateOptions): Promise<void> {
        await this.api.request({
            path: "dataset/rate", method: "POST", body: {
                dataset, id, rate: rating
            } as DatasetRateBody
        }).catch(() => {});
    }

    public buildRateButtons({ dataset, id, selected }: DatasetToolbarOptions): ButtonBuilder[] {
        const buttons: ButtonBuilder[] = [];

        for (const choice of DatasetRateChoices) {
            const current: boolean = choice.value === selected;

            buttons.push(new ButtonBuilder()
                .setEmoji(choice.emoji)
                .setDisabled(selected != undefined)
                .setStyle(current ? ButtonStyle.Primary : ButtonStyle.Secondary)
                .setCustomId(`dataset:rate:${dataset}:${id}:${choice.value}`)
            );
        }

        if (selected != undefined) buttons.push(new ButtonBuilder()
            .setLabel("Thanks for your feedback!").setEmoji("🎉")
            .setCustomId(randomUUID())
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true)
        );

        return buttons;
    }

    public buildRateToolbar(options: DatasetToolbarOptions): ActionRowBuilder<ButtonBuilder> {
        return new ActionRowBuilder<ButtonBuilder>()
            .setComponents(this.buildRateButtons(options));
    }

    public async handleInteraction({ interaction, data: { dataset, id, rating } }: InteractionHandlerRunOptions<ButtonInteraction, DatasetInteractionHandlerData>): InteractionHandlerResponse {
        await this.rate({ dataset, id, rating });
        
        await interaction.update({
            components: [ this.buildRateToolbar({
                dataset, id, selected: rating
            }) ]
        });
    }
}