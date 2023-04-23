import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";

import { OpenAIChatBody, OpenAIChatCompletionsData, OpenAIChatMessage, OpenAIPartialCompletionsJSON } from "./types/chat.js";
import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js"
import { GPTGenerationErrorType, GPTGenerationError } from "../error/gpt/generation.js";
import { OpenAIModerationsBody, OpenAIModerationsData } from "./types/moderation.js";
import { OpenAICompletionsBody, OpenAICompletionsData, OpenAICompletionsJSON, OpenAIUsageCompletionsData } from "./types/completions.js";
import { OpenAIErrorData } from "./types/error.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";

export type OpenAIAPIPath = "moderations" | "chat/completions" | "completions";

const OpenAIAPIBasePaths = {
    Bypass:   "https://api.openai.com/v1", // "https://api.hypere.app",
    Official: "https://api.openai.com/v1"
}

export class OpenAIManager {
    /* Base application class */
    protected readonly bot: Bot;

    /* OpenAI API token */
    public token: string | null;

    constructor(bot: Bot) {
        this.token = null;
        this.bot = bot;
    }

    /**
     * Initialize the OpenAI API.
     */
    public async setup(token: string): Promise<void> {
        this.token = token;
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
    public async chat(options: OpenAIChatBody, progress?: (data: OpenAIPartialCompletionsJSON) => Promise<void> | void): Promise<OpenAIChatCompletionsData> {
        /* Latest message of the stream */
        let latest: OpenAIPartialCompletionsJSON | null = null;

        /* Whether the generation is finished */
        let done: boolean = false;

        /* Make the request to OpenAI's API. */
        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            const abortTimer: NodeJS.Timeout = setTimeout(() => {
                controller.abort();
                reject(new TypeError("Request timed out"));
            }, 10 * 1000);

            try {
                await fetchEventSource(this.url("chat/completions"), {
                    headers: this.headers() as any,
                    body: JSON.stringify(options),
                    signal: controller.signal,
                    method: "POST",

                    onclose: () => {
                        /* If the API didn't send us [DONE] back, but still finished the request, manually mark the request as done. */
                        if (!done) {
                            done = true;

                            controller.abort();
                            resolve();
                        }
                    },
                    
                    onerror: (error) => {
                        clearTimeout(abortTimer);
                        reject(error);
                    },
        
                    onopen: async (response) => {
                        clearTimeout(abortTimer);

                        /* If the request failed for some reason, throw an exception. */
                        if (response.status !== 200) {
                            const error = await this.error(response, "chat/completions");

                            controller.abort();
                            reject(error);
                        }
                    },

                    onmessage: async (event) => {
                        /* If the request is finished, resolve the promise & mark the request as done. */
                        if (event.data === "[DONE]") {
                            done = true;

                            controller.abort();
                            return resolve();
                        }
        
                        /* Response data */
                        const data: OpenAIPartialCompletionsJSON = JSON.parse(event.data);
                        if (data === null || data === undefined || data.choices === undefined || data.choices === null) return;

                        /* If an error occurred, stop generation at this point. */
                        if (data.choices[0].error !== undefined) {
                            controller.abort();
                            done = true;

                            return reject(new GPTAPIError({
                                endpoint: "/chat/completions",
                                code: 400,
                                id: data.choices[0].error.code,
                                message: data.choices[0].error.message
                            }));
                        }

                        if (data.choices[0].delta.content !== undefined) latest = {
                            choices: [
                                {
                                    delta: {
                                        content: latest !== null && latest.choices[0].delta.content ? `${latest.choices[0].delta.content}${data.choices[0].delta.content}` : data.choices[0].delta.content,
                                        role: "assistant"
                                    },
                                    finish_reason: data.choices[0].finish_reason,
                                    index: data.choices[0].index,
                                    error: data.choices[0].error
                                }
                            ]
                        };

                        /* Update the finish reason too, once available. */
                        if (data.choices[0].finish_reason !== null && latest) latest.choices[0].finish_reason = data.choices[0].finish_reason;
                        if (progress !== undefined && latest !== null) progress(latest);
                    },
                });

            } catch (error) {
                if (error instanceof GPTAPIError) return reject(error);
                clearTimeout(abortTimer);

                reject(new GPTGenerationError({
                    type: GPTGenerationErrorType.Other,
                    cause: error as Error
                }));
            }
        });

        /* If the request was not finished, throw an error. */
        if (!done || (latest as any) === null || !(latest as any).choices[0]?.delta?.content) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        const usage: OpenAIUsageCompletionsData = {
            completion_tokens: getPromptLength(latest!.choices[0].delta.content!),
            prompt_tokens: countChatMessageTokens(options.messages),
            total_tokens: 0
        }

        usage.total_tokens = usage.completion_tokens + usage.total_tokens;

        return {
            response: {
                message: latest!.choices[0].delta as OpenAIChatMessage,
                finish_reason: latest!.choices[0].finish_reason!,
                index: latest!.choices[0].index
            },

            usage
        };
    }

    /**
     * Complete the provided prompt using the specified model.
     * @param input Input text to check
     * 
     * @throws An error, if the request to OpenAI failed
     * @returns Moderation data
     */
    public async complete(options: OpenAICompletionsBody, progress?: (data: OpenAICompletionsJSON) => Promise<void> | void): Promise<OpenAICompletionsData> {
        /* Latest message of the stream */
        let latest: OpenAICompletionsJSON | null = null;

        /* Whether the generation is finished */
        let done: boolean = false;

        /* Make the request to OpenAI's API. */
        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            const abortTimer: NodeJS.Timeout = setTimeout(() => {
                controller.abort();
                reject(new TypeError("Request timed out"));
            }, 10 * 1000);

            try {
                fetchEventSource(this.url("completions"), {
                    headers: this.headers() as any,
                    body: JSON.stringify(options),
                    mode: "cors",
                    signal: controller.signal,
                    method: "POST",

                    onclose: () => {
                        /* If the API didn't send us [DONE] back, but still finished the request, manually mark the request as done. */
                        if (!done) {
                            done = true;

                            controller.abort();
                            resolve();
                        }
                    },
                    
                    onerror: (error) => {
                        clearTimeout(abortTimer);
                        throw error;
                    },
        
                    onopen: async (response) => {
                        clearTimeout(abortTimer);

                        /* If the request failed for some reason, throw an exception. */
                        if (response.status !== 200) {
                            /* Response data */
                            const data: any | null = await response.clone().json().catch(() => null);
            
                            /* If an error message was given in the response body, show it to the user. */
                            if (data !== null) {
                                const error: Error = await this.error(response, "completions");

                                controller.abort();
                                reject(error);
                            }
                        }
                    },

                    onmessage: async (event) => {
                        /* If the request is finished, resolve the promise & mark the request as done. */
                        if (event.data === "[DONE]") {
                            done = true;

                            controller.abort();
                            return resolve();
                        }
        
                        /* Response data */
                        const data: OpenAICompletionsJSON = JSON.parse(event.data);
                        if (data === null || data.choices === undefined || (data.choices && data.choices.length === 0)) return;

                        latest = {
                            usage: data.usage,

                            choices: [
                                {
                                    text: latest !== null ? `${latest.choices[0].text}${data.choices[0].text}` : data.choices[0].text,
                                    finish_reason: data.choices[0].finish_reason
                                }
                            ]
                        };

                        if (progress !== undefined) progress(latest);
                    },
                });

            } catch (error) {
                if (error instanceof GPTAPIError) return reject(error);

                reject(new GPTGenerationError({
                    type: GPTGenerationErrorType.Other,
                    cause: error as Error
                }));
            }
        });

        /* If the request was not finished, throw an error. */
        if (!done && latest === null) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return {
            response: latest!.choices[0],
            usage: latest!.usage
        };
    }

    /**
     * Check the given input string for profanity & other types of vulgar language.
     * @param input Input text to check
     * 
     * @throws An error, if the request to OpenAI failed
     * @returns Moderation data
     */
    public async moderate(input: string): Promise<OpenAIModerationsData> {
        return this.request<OpenAIModerationsData>("moderations", "POST", {
            input
        });
    }

    private async request<T>(path: OpenAIAPIPath, method: "GET" | "POST" = "GET", data?: { [key: string]: any }): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : null,
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (response.status !== 200) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.json();
        return body;
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
        if (this.token === null) throw new Error("API is not initialized");

        return {
            Authorization: `Bearer ${this.token}`,
            "Content-Type": "application/json"
        };
    }
}