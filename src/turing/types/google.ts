import { type OpenAIChatMessage } from "./chat.js";

export interface TuringGoogleChatBody {
    model: "chat-bison";
    messages: GoogleChatMessage[];
    max_tokens?: number;
    temperature?: number;
}

export interface GoogleChatMessage {
    role: "system" | "user" | "bot";
    content: string;
}

export interface GoogleChatSafetyAttribute {
    blocked: boolean;
    categories: string[];
    scores: number[];
}

export interface GoogleChatCandidate {
    author: "1";
    content: string;
}

export interface GoogleChatPrediction {
    safetyAttributes: [ GoogleChatSafetyAttribute ];
    candidates: [ GoogleChatCandidate ];
}

export interface GoogleChatResult {
    predictions: [ GoogleChatPrediction ];
}