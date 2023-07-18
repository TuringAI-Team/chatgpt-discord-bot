import { LLaMAChatMessage, LLaMAChatResult, LLaMAPartialChatResult } from "../../turing/types/llama.js";
import { MessageType, PartialResponseMessage } from "../types/message.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { ModelGenerationOptions } from "../types/options.js";
import { ChatModel, ModelType } from "../types/model.js";
import { ChatClient, PromptData } from "../client.js";

export class LLaMAModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "LLaMA", type: ModelType.LLaMA
        });
    }

    private process(data: LLaMAPartialChatResult | LLaMAChatResult, prompt: PromptData): PartialResponseMessage {
        if (data.status === "queued") return {
            type: MessageType.Notice,
            text: "Waiting in queue"
        };

        let content: string = data.result.trim();
        if (content.includes("User:")) content = content.split("User:")[0];

        if (content.length === 0) return {
            type: MessageType.Notice,
            text: "Generating"
        };

        return {
            raw: {
                usage: {
                    completion: getPromptLength(data.result),
                    prompt: prompt.length
                },

                cost: data.cost > 0 ? data.cost : undefined
            },

            text: content
        };
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

        for (const entry of options.conversation.history.get(5)) {
            messages.push(
                { role: "user", content: entry.input.content },
                { role: "assistant", content: entry.output.text }
            );
        }

        messages.push({
            role: "user", content: options.prompt
        });

        const result = await this.client.manager.bot.turing.llama({
            messages, max_tokens: prompt.max, temperature: 0.4
        }, data => options.progress(this.process(data, prompt)));

        return this.process(result, prompt);
    }
}