import { AnthropicChatMessage, AnthropicChatModel } from "../../turing/types/anthropic.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class AnthropicModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Anthropic", type: ModelType.Anthropic,
            capabilities: [ ModelCapability.UserLanguage, ModelCapability.ImageViewing ]
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);
        const messages: AnthropicChatMessage[] = [];

        messages.push(
            { role: "user", content: "Who are you?" },
            { role: "assistant", content: prompt.parts.Initial.content }
        );

        if (prompt.parts.Personality) messages.push(
            { role: "user", content: "What will you act like for the entire conversation?" },
            { role: "assistant", content: prompt.parts.Personality.content }
        );

        if (prompt.parts.Other) messages.push(
            { role: "user", content: "What will you also acknowlewdge?" },
            { role: "assistant", content: prompt.parts.Other.content }
        );

        /* Add all of the user & assistant interactions to the prompt. */
        messages.push(...prompt.messages);

        /* Which model to use, depending on the context & generation limits */
        const model: AnthropicChatModel = options.settings.options.settings.model ?? "claude-instant-1";

        const result = await this.client.manager.bot.turing.anthropic({
            messages, max_tokens: prompt.max, model, temperature: 0.3
        }, data => options.progress({ text: data.completion }));

        return {
            raw: {
                finishReason: result.stop_reason === "max_tokens" ? "length" : "stop",
                
                usage: {
                    completion: getPromptLength(result.completion),
                    prompt: prompt.length
                }
            },

            text: result.completion
        };
    }
}