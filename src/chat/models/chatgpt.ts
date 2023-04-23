import { OpenAIChatCompletionsData, OpenAIPartialCompletionsJSON } from "../../openai/types/chat.js";
import { ChatModel, ConstructorModelOptions, ModelCapability, ModelType } from "../types/model.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { ModelGenerationOptions } from "../types/options.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";

export class ChatGPTModel extends ChatModel {
    constructor(client: ChatClient, options?: ConstructorModelOptions) {
        super(client, options ?? {
            name: "ChatGPT",
            type: ModelType.OpenAIChat,

            capabilities: [ ModelCapability.ImageViewing ]
        });
    }

    /**
     * Make the actual call to the OpenAI API, to generate a response for the given prompt.
     * This always concatenates the history & starting prompt.
     * 
     * @param options Generation options
     * @returns Generated response
     */
    protected async chat(options: ModelGenerationOptions, prompt: PromptData, progress?: (response: OpenAIPartialCompletionsJSON) => Promise<void> | void): Promise<OpenAIChatCompletionsData> {
        const data: OpenAIChatCompletionsData = await this.client.session.ai.chat({
            model: options.conversation.tone.model.model ?? "gpt-3.5-turbo",
            stop: "User:",
            stream: true,

            user: options.conversation.userIdentifier,

            temperature: options.conversation.tone.model.temperature ?? 0.5,
            max_tokens: isFinite(prompt.max) ? prompt.max : undefined,
            messages: Object.values(prompt.parts),
        }, progress);

        if (data.response.message.content.trim().length === 0) throw new GPTGenerationError({ type: GPTGenerationErrorType.Empty });
        return data;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt: PromptData = await this.client.buildPrompt(options, "ChatGPT");
        const data: OpenAIChatCompletionsData = await this.chat(options, prompt, response => options.progress({ text: response.choices[0].delta.content! }));

        return {
            raw: {
                finishReason: data.response.finish_reason ? data.response.finish_reason === "length" ? "maxLength" : "stop" : null,
                
                usage: {
                    completion: data.usage.completion_tokens,
                    prompt: data.usage.prompt_tokens
                }
            },

            text: data.response.message.content
        };
    }
}