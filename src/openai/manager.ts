import { OpenAICompletionsBody, OpenAICompletionsData, OpenAICompletionsJSON, OpenAIPartialCompletionsJSON, OpenAIUsageCompletionsData } from "./types/completions.js";
import { OpenAIChatBody, OpenAIChatCompletionsData, OpenAIChatMessage, OpenAIPartialChatCompletionsJSON } from "./types/chat.js";
import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js"
import { GPTGenerationErrorType, GPTGenerationError } from "../error/gpt/generation.js";
import { OpenAIErrorData } from "./types/error.js";
import { StreamBuilder } from "../util/stream.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";

export type OpenAIAPIPath = "chat/completions" | "completions"

export class OpenAIManager {
    /* Base application class */
    protected readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Various OpenAI APIs
     */

    /**
     * Complete the provided prompt using the specified model.
     * @param input Input text to check
     * 
     * @throws An error, if the request to OpenAI failed
     * @returns Moderation data
     */
    public async chat(options: OpenAIChatBody, progress?: (data: OpenAIPartialChatCompletionsJSON) => Promise<void> | void): Promise<OpenAIChatCompletionsData> {
        return await new StreamBuilder<
            OpenAIChatBody, OpenAIPartialChatCompletionsJSON, OpenAIPartialChatCompletionsJSON, OpenAIChatCompletionsData
        >({
            body: options,

            error: async response => {
                if (response.status === 400) return new GPTGenerationError({
                    type: GPTGenerationErrorType.Moderation
                });

                return this.error(response, "chat/completions");
            },

            url: this.url("chat/completions"),
            headers: this.headers(),

            progress: (data, old) => {
                if (data.error != undefined) {
                    throw new GPTAPIError({
                        endpoint: "/chat/completions",
                        code: 400,
                        id: data.error.type,
                        message: data.error.message
                    });
                }

                if (!data.choices[0].delta.content) return null;

                const updated: OpenAIPartialChatCompletionsJSON = {
                    choices: [
                        {
                            delta: {
                                content: old !== null && old.choices[0].delta.content ? `${old.choices[0].delta.content}${data.choices[0].delta.content ? data.choices[0].delta.content : ""}` : data.choices[0].delta.content,
                                role: "assistant"
                            },

                            finish_reason: data.choices[0].finish_reason,
                            index: data.choices[0].index
                        }
                    ]
                };

                if (progress) progress(updated);
                return updated;
            },

            process: final => {
                const usage: OpenAIUsageCompletionsData = {
                    completion_tokens: getPromptLength(final.choices[0].delta.content!),
                    prompt_tokens: countChatMessageTokens(options.messages),
                    total_tokens: 0
                }
    
                usage.total_tokens = usage.completion_tokens + usage.total_tokens;
    
                return {
                    response: {
                        message: final.choices[0].delta as OpenAIChatMessage,
                        finish_reason: final.choices[0].finish_reason!,
                        index: final.choices[0].index
                    },
    
                    usage
                };
            }
        }).run();
    }

    /**
     * Complete the provided prompt using the specified model.
     * @param input Input text to check
     * 
     * @throws An error, if the request to OpenAI failed
     * @returns Moderation data
     */
    public async complete(options: OpenAICompletionsBody, progress?: (data: OpenAIPartialCompletionsJSON) => Promise<void> | void): Promise<OpenAICompletionsData> {
        return await new StreamBuilder<
            OpenAICompletionsBody, OpenAIPartialCompletionsJSON, OpenAICompletionsJSON, OpenAICompletionsData
        >({
            body: options,

            error: async response => {
                if (response.status === 400) return new GPTGenerationError({
                    type: GPTGenerationErrorType.Moderation
                });

                return this.error(response, "completions");
            },

            url: this.url("completions"),
            headers: this.headers(),

            progress: (data, old) => {
                if (data.error != undefined) {
                    throw new GPTAPIError({
                        endpoint: "/chat/completions",
                        code: 400,
                        id: data.error.type,
                        message: data.error.message
                    });
                }

                const updated: OpenAIPartialCompletionsJSON = {
                    choices: [
                        {
                            text: old !== null && old.choices[0].text ? `${old.choices[0].text}${data.choices[0].text}` : data.choices[0].text,
                            finish_reason: data.choices[0].finish_reason
                        }
                    ]
                };

                if (progress) progress(updated);
                return updated;
            },

            process: final => {
                const usage: OpenAIUsageCompletionsData = {
                    completion_tokens: getPromptLength(final.choices[0].text),
                    prompt_tokens: getPromptLength(options.prompt),
                    total_tokens: 0
                }
    
                usage.total_tokens = usage.completion_tokens + usage.total_tokens;
    
                return {
                    response: {
                        text: final.choices[0].text,
                        finish_reason: final.choices[0].finish_reason
                    },
    
                    usage
                };
            }
        }).run();
    }

    /**
     * Extract the error from a failed request, and generate a corresponding GPTAPIError exception.
     * @param response Failed HTTP request
     * 
     * @returns GPT API error class
     */
    private async error(response: Response, path: OpenAIAPIPath): Promise<GPTAPIError> {
        /* Error data */
        let body: OpenAIErrorData | null = null;

        /* Try to parse the given error data in the response. */
        try {
            body = await response.json() as OpenAIErrorData;
        } catch (error ) {
            body = null;
        }

        return new GPTAPIError({
            endpoint: `/${path}`,
            code: response.status,
            id: body != null ? body.error.type : null,
            message: body !== null ? body.error.message : null
        });
    }

    public url(path: OpenAIAPIPath): string {
        return `https://api.openai.com/v1/${path}`;
    }

    /* Headers used for OpenAI API requests */
    public headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.bot.app.config.openAI.key}`,
            "Content-Type": "application/json"
        };
    }
}