import { OpenChatMessage, OpenChatModel } from "../../turing/types/openchat.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class AnthropicModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "OpenChat", type: ModelType.OpenChat,
            capabilities: [ ModelCapability.UserLanguage ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);
        const messages: OpenChatMessage[] = [];

        messages.push(
            { role: "user", content: "Who are you?" },
            { role: "assistant", content: prompt.parts.Initial.content }
        );

        if (prompt.parts.Personality) messages.push(
            { role: "user", content: "What will you act like?" },
            { role: "assistant", content: prompt.parts.Personality.content }
        );

        if (prompt.parts.Other) messages.push(
            { role: "user", content: "What will you also do?" },
            { role: "assistant", content: prompt.parts.Other.content }
        );

        /* Add all of the user & assistant interactions to the prompt. */
        messages.push(...prompt.messages);

        /* Which model to use, depending on the context & generation limits */
        const model: OpenChatModel = options.settings.options.settings.model ?? "openchat_v3.2";

        const result = await this.client.manager.bot.turing.openChat({
            messages, max_tokens: prompt.max, model, temperature: 0.3
        }, data => options.progress({ text: data.result }));

        return {
            raw: {
                finishReason: result.finishReason === "max_tokens" ? "length" : "stop",
                
                usage: {
                    completion: getPromptLength(result.result),
                    prompt: prompt.length
                }
            },

            text: result.result
        };
    }
}