import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { TuringChatResult } from "../../turing/api.js";
import { ChatClient, PromptData } from "../client.js";

export class TuringModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Turing",
            type: ModelType.Turing,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Build the formatted prompt. */
        const prompt: PromptData = await this.client.buildPrompt(options);

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringChatResult = await this.client.session.manager.bot.turing.chat({
            model: options.settings.options.settings.model!,
            prompt: prompt.prompt,
            raw: true
        });

        return {
            text: result.response
        };
    }
}