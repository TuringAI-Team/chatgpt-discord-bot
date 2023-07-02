import { ChatResetOptions, ModelGenerationOptions } from "../types/options.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { PartialResponseMessage } from "../types/message.js";
import { TuringChatResult } from "../../turing/api.js";
import { ChatClient } from "../client.js";

export class TuringModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Turing",
            type: ModelType.Turing,

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const model = options.conversation.model(options.db);

        /* Build the formatted prompt. */
        const prompt: string = model.id !== "bard"
            ? (await this.client.buildPrompt(options)).prompt

            /* Use the raw prompt for Bard instead, as conversation history is tracked server-side. */
            : options.prompt;

        /* Generate a response for the user's prompt using the Turing API. */
        const result: TuringChatResult = await this.client.manager.bot.turing.chat({
            model: options.settings.options.settings.model!,
            conversation: options.conversation,
            prompt: prompt,
            raw: true
        });

        return {
            text: result.response,

            raw: {
                usage: {
                    prompt: getPromptLength(prompt),
                    completion: getPromptLength(result.response)
                }
            }
        };
    }
}