import { setTimeout } from "timers/promises";
import { Prediction } from "replicate";

import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ReplicateChatTone } from "../../conversation/tone.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class ReplicateModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Replicate",
            type: ModelType.Replicate,

            capabilities: [ ModelCapability.UserLanguage ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* If the tone class for some reason doesn't match as it should, throw an error. */
        if (!(options.conversation.tone instanceof ReplicateChatTone)) throw new Error("Wrong tone class for Replicate; must be ReplicateChatTone");
        const tone: ReplicateChatTone = options.conversation.tone;

        /* Name of the model, split into two parts */
        const [ modelOwner, modelName ] = tone.model.model!.split("/");

        /* Replicate model for the tone */
        const model = await this.client.session.manager.bot.replicate.api.models.get(modelOwner, modelName);

        const format = (output: string[] | null): string | null => {
            if (output === null) return null;
            if (tone.formatter) return tone.formatter(tone, output);

            /* Concatenate the output tokens together. */
            const concatenated: string = typeof output === "string" ? output : output.join("");
            return concatenated;
        }

        /* Input object for the model */
        const input: any = await tone.build(this.client, options);

        /* Start the prediction. */
        const prediction: Prediction = await this.client.session.manager.bot.replicate.api.predictions.create({
            version: model.latest_version!.id,
            input: input as object
        });

        /* Latest prediction result */
        let latest: Prediction = null!;

        do {
            /* Get the latest prediction result. */
            latest = await this.client.session.manager.bot.replicate.api.predictions.get(prediction.id);
            
            const formatted: string | null = format(latest.output);
            if (formatted) options.progress({ text: formatted });

            await setTimeout(500);
        } while (latest.output === null || (latest.status === "starting" || latest.status === "processing"));

        if (latest === null || latest.error || latest.status === "failed") throw new GPTGenerationError({
            type: GPTGenerationErrorType.Other
        });
        
        return {
            text: format(latest.output)!
        };
    }
}