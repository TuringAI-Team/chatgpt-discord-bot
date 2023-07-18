import { type OpenAIChatMessage } from "./openai/chat.js";

export interface TuringLLaMABody {
    messages: LLaMAChatMessage[];
    max_tokens?: number;
    temperature?: number;
}

export type LLaMAChatMessage = OpenAIChatMessage

export type LLaMAStatus = "queued" | "generating" | "done"

export interface LLaMAPartialChatResult {
    cost: number;
    result: string;
    id: string;
    status: LLaMAStatus | null;
    done: boolean;
}

export type LLaMAChatResult = LLaMAPartialChatResult