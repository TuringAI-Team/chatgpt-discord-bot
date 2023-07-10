import { type OpenAIChatMessage } from "./openai/chat.js";

type AnthropicStopReason = "stop_sequence" | "max_tokens"
export type AnthropicChatModel = "claude-instant-1" | "claude-instant-1-100k"

export interface TuringAnthropicChatBody {
    model: AnthropicChatModel;
    messages: AnthropicChatMessage[];
    max_tokens?: number;
    temperature?: number;
    stream?: boolean;
}

export type AnthropicChatMessage = OpenAIChatMessage

export interface AnthropicPartialChatResult {
    completion: string;
    stop_reason: null;
    stop: null;
    done: false;
}

export interface AnthropicChatResult {
    completion: string;
    stop_reason: AnthropicStopReason;
    stop: string | null;
    done: true;
}