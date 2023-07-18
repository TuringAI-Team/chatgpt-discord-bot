import { getPromptLength } from "../../conversation/utils/length.js";
import { LLaMAChatMessage } from "../../turing/types/llama.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatModel, ModelType } from "../types/model.js";
import { ChatClient } from "../client.js";

export class LLaMAModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "LLaMA", type: ModelType.LLaMA
        });
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);
        const messages: LLaMAChatMessage[] = [];

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

        const result = await this.client.manager.bot.turing.llama({
            messages, max_tokens: prompt.max, temperature: 0.3
        }, data => options.progress({ text: data.result }));

        return {
            raw: {
                usage: {
                    completion: getPromptLength(result.result),
                    prompt: prompt.length
                }
            },

            text: result.result
        };
    }
}