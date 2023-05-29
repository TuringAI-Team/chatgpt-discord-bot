import { TuringChatBingPartialResult, TuringChatBingResult } from "../../turing/api.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatModel, ModelType } from "../types/model.js";
import { ChatClient } from "../client.js";

export class BingModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Bing",
            type: ModelType.TuringBing
        });
    }

    private process(options: ModelGenerationOptions, result: TuringChatBingPartialResult | TuringChatBingResult): PartialResponseMessage | null {
        /* Construct the final, formatted response. */
        let final: string = result.response;

        return {
            display: final, text: final
        };
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Generate a response for the user's prompt using the Turing API. */
        const result = await this.client.session.manager.bot.turing.bing({
            conversation: options.conversation,

            progress: async result => {
                const formatted = this.process(options, result);
                if (formatted !== null) options.progress(formatted);
            },

            prompt: options.prompt,
            tone: "balanced"
        });

        return this.process(options, result)!;
    }
}