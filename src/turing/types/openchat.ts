import { type OpenAIChatMessage } from "./openai/chat.js";

type OpenChatStopReason = "stop_sequence" | "max_tokens"
export type OpenChatModel = "openchat_v3.2" | string

export interface TuringOpenChatBody {
    model: OpenChatModel;
    messages: OpenChatMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export type OpenChatMessage = OpenAIChatMessage

export interface OpenChatPartialResult {
    result: string;
    cost: number;
    finishReason: null;
    done: boolean;
}

export interface OpenChatChatResult {
    result: string;
    cost: number;
    finishReason: OpenChatStopReason;
    done: true;
}