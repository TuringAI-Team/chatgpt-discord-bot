import { GoogleChatMessage, GoogleChatPrediction, GoogleChatResult } from "../../turing/types/google.js";
import { ChatModel, ModelCapability, ModelType } from "../types/model.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient } from "../client.js";

export class GoogleModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Google",
            type: ModelType.Google,

            capabilities: [ ModelCapability.ImageViewing ]
        });
    }

    private process(data: GoogleChatResult): PartialResponseMessage {
        const prediction: GoogleChatPrediction = data.predictions[0];

        const attribute = prediction.safetyAttributes[0];
        const candidate = prediction.candidates[0];

        return {
            text: candidate.content,

            embeds: attribute && attribute.blocked ? [
                {
                    description: "Your prompt was **blocked** by Google's filters.",
                    color: "Orange"
                }
            ] : []
        }
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt = await this.client.buildPrompt(options);
        const messages: GoogleChatMessage[] = [];

        messages.push({
            role: "system", content: [ prompt.parts.Initial, prompt.parts.Personality ].filter(Boolean).map(m => m!.content).join("\n\n")
        });

        for (const entry of options.conversation.history.slice(-5)) {
            messages.push(
                { role: "user", content: entry.input.content },
                { role: "bot", content: entry.output.text }
            );
        }

        messages.push({
            role: "user", content: options.prompt
        });

        const result = await this.client.manager.bot.turing.google({
            messages, max_tokens: prompt.max, model: options.settings.options.settings.model!
        });

        return this.process(result);
    }
}