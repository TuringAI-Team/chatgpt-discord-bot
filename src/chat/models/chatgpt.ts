import { OpenAIChatCompletionsData, OpenAIPartialChatCompletionsJSON } from "../../openai/types/chat.js";
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

            capabilities: [ ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    /**
     * Make the actual call to the OpenAI API, to generate a response for the given prompt.
     * This always concatenates the history & starting prompt.
     * 
     * @param options Generation options
     * @returns Generated response
     */
    protected async chat(options: ModelGenerationOptions, prompt: PromptData, progress: (response: OpenAIPartialChatCompletionsJSON) => Promise<void> | void): Promise<OpenAIChatCompletionsData> {
        let data: OpenAIChatCompletionsData | null = null;

        /* Turing ChatGPT API */
        /*if (!options.settings.options.settings.model || options.settings.options.settings.model === "gpt-3.5-turbo") {
            data = await this.client.session.manager.bot.turing.openAI({
                model: options.settings.options.settings.model ?? "gpt-3.5-turbo",
                temperature: options.settings.options.settings.temperature ?? 0.5,
                messages: Object.values(prompt.parts),
                maxTokens: prompt.max,
                pw: false
            }, progress);
        
        /* Regular OpenAI API */
        //} else {
            data = await this.client.session.ai.chat({
                model: options.settings.options.settings.model ?? "gpt-3.5-turbo-0613",
                stream: options.partial,
                stop: "User:",
    
                user: options.conversation.userIdentifier,
    
                temperature: options.settings.options.settings.temperature ?? 0.5,
                max_tokens: isFinite(prompt.max) ? prompt.max : undefined,
                messages: Object.values(prompt.parts),
            }, progress);
        //}

        if (data === null || data.response.message.content.trim().length === 0) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return data;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        const prompt: PromptData = await this.client.buildPrompt(options);

        const data: OpenAIChatCompletionsData = await this.chat(
            options, prompt, response => options.progress({ text: response.choices[0].delta.content! })
        );

        return {
            raw: {
                finishReason: data.response.finish_reason ? data.response.finish_reason === "length" ? "maxLength" : "stop" : undefined,
                
                usage: {
                    completion: data.usage.completion_tokens,
                    prompt: data.usage.prompt_tokens
                }
            },

            text: data.response.message.content
        };
    }
}