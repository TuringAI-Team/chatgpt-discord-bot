import { OpenAIUsageCompletionsData, OpenAICompletionsBody } from "./completions.js";

/**
 * POST https://api.openai.com/v1/chat/completions
 */
export type OpenAIChatBody = Pick<OpenAICompletionsBody, "temperature" | "stop" | "stream" | "max_tokens" | "frequency_penalty" | "presence_penalty" | "top_p" | "user"> & {
    /** ID of the model to use */
    model: "gpt-3.5-turbo" | "gpt-4" | string;

    /* Previous chat history & instructions */
    messages: OpenAIChatMessage[];
}

export interface OpenAIChatMessage {
    role: "system" | "assistant" | "user";
    content: string;
}

export interface OpenAIChatResponse {
    message: OpenAIChatMessage;
    finish_reason: "stop" | "length" | null;
    index: number;
}

export interface OpenAIChatErrorJSON {
    message: string;
    type: string;
    param: null;
    code: null;
}

export interface OpenAIPartialChatResponse {
    delta: Partial<OpenAIChatMessage>;
    finish_reason: null | "stop" | "length";
    index: number;
    error?: OpenAIChatErrorJSON;
}

export interface OpenAIPartialCompletionsJSON {
    choices: [ OpenAIPartialChatResponse ];
}

export interface OpenAIChatCompletionsJSON {
    choices: [ OpenAIChatResponse ];
    usage: OpenAIUsageCompletionsData;
}

export interface OpenAIChatCompletionsData {
    /** How many tokens were used for the generation */
    usage: OpenAIUsageCompletionsData;

    /** Generated response */
    response: OpenAIChatResponse;
}