import { Awaitable } from "discord.js";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier } from "../../../conversation/settings/plugin.js";
import { DatabaseUser } from "../../../db/schemas/user.js";
import { TuringChatPluginsTool } from "./plugins.js";

type TuringOpenAIChatModel = "gpt-3.5-turbo" | "gpt-4" | string

export interface TuringOpenAIChatOptions {
    /* Which model to use */
    model: TuringOpenAIChatModel;

    /* Maximum amount of generation tokens */
    tokens: number;

    /** What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. */
    temperature?: number;

    /* OpenAI chat messages to send to the model */
    messages: OpenAIChatMessage[];

    /* Plugins to use for this request */
    plugins?: ChatSettingsPlugin[];

    /* Progress callback to call when a new token is generated */
    progress?: (data: TuringOpenAIPartialResult) => Awaitable<void>;
}

export interface TuringOpenAIChatBody {
    /** ID of the model to use */
    model: TuringOpenAIChatModel;

    /* Previous chat history & instructions */
    messages: OpenAIChatMessage[];

    /** What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. */
    temperature?: number;

    /** An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered  */
    top_p?: number;

    /** Maximum number of tokens to generate in the completion */
    max_tokens?: number;

    /* Which plugins to use */
    plugins?: ChatSettingsPluginIdentifier[];

    /* Whether streaming mode should be used */
    stream?: boolean;
}

export interface OpenAIChatMessage {
    role: "system" | "assistant" | "user";
    content: string;
}

export type TuringOpenAIPartialResult = TuringOpenAIResult

export interface TuringOpenAIResult {
    result: string;
    done: boolean;
    cost: number;
    finishReason: "length" | "stop" | null;
    tool?: TuringChatPluginsTool;
}