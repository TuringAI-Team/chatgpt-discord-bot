import { AnthropicChatMessage, AnthropicChatModel } from "../../turing/types/anthropic.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class AnthropicModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Anthropic",
            type: ModelType.Anthropic,

            capabilities: [ ModelCapability.UserLanguage ]
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

        for (const entry of options.conversation.history.slice(-5)) {
            messages.push(
                { role: "user", content: entry.input.content },
                { role: "assistant", content: entry.output.text }
            );
        }

        messages.push({
            role: "user", content: options.prompt
        });

        /* Which model to use, depending on the context & generation limits */
        const model: AnthropicChatModel = prompt.length + prompt.max >= 9000 ? "claude-instant-1-100k" : "claude-instant-1";

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