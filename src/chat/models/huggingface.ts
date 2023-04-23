import { countChatMessageTokens, getPromptLength } from "../../conversation/utils/length.js";
import { OpenAIChatMessage } from "../../openai/types/chat.js";
import { HFModel, HFResponse } from "../other/huggingface.js";
import { PartialResponseMessage } from "../types/message.js";
import { ModelGenerationOptions } from "../types/options.js";
import { ChatModel, ModelType } from "../types/model.js";
import { ChatClient } from "../client.js";

export class HuggingFaceModel extends ChatModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Hugging Face",
            type: ModelType.HuggingFace
        });
    }

    public async complete({ progress, conversation, prompt }: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const messages: OpenAIChatMessage[] = [
            {
                role: "user",
                content: prompt
            }
        ];

        const data: HFResponse | null = await this.client.session.manager.bot.hf.runTextInference({
            progress: response => progress({ text: response.content }),
            messages: messages,

            maxTokens: conversation.tone.settings.generationTokens ?? 400,
            model: conversation.tone.model.model! as HFModel
        });

        return {
            text: data.content,

            raw: {
                usage: {
                    completion: getPromptLength(data.content),
                    prompt: countChatMessageTokens(messages)
                },

                finishReason: data.finishReason
            }
        };
    }
}