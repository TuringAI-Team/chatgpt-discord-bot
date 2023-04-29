import { get_encoding } from "@dqbd/tiktoken";
export const encoder = get_encoding("cl100k_base");

import { OpenAIChatMessage } from "../../openai/types/chat.js";

/* Maximum context history length in total */
export const GPT_MAX_CONTEXT_LENGTH = {
    Free: 525,
    Voter: 575,
    GuildPremium: 650,
    UserPremium: 800
}

/* Maximum generation length in total */
export const GPT_MAX_GENERATION_LENGTH = {
    Free: 300,
    Voter: 325,
    GuildPremium: 320,
    UserPremium: 600
}

/**
 * Get the length of a prompt.
 * @param content Prompt to check
 * 
 * @returns Length of the prompt, in tokens
 */
export const getPromptLength = (content: string): number => {
    content = content.replaceAll("<|endoftext|>", "<|im_end|>").replaceAll("<|endofprompt|>", "<|im_end|>");
    return encoder.encode(content).length;
}

/**
 * Whether the length of a prompt is "usable".
 * @param content Prompt to check
 * 
 * @returns Whether the prompt is usable
 */
export const isPromptLengthAcceptable = (content: string, max: number): boolean => {
    return getPromptLength(content) < max;
}

export const getChatMessageLength = (...messages: OpenAIChatMessage[]): number => {
    /* Total tokens used for the messages */
    let total: number = 0;

    for (const message of messages) {
        /* Map each property of the message to the number of tokens it contains. */
        const propertyTokenCounts = Object.entries(message).map(([_, value]) => {
            /* Count the number of tokens in the property value. */
            return getPromptLength(value);
        });

        /* Sum the number of tokens in all properties and add 4 for metadata. */
        total += propertyTokenCounts.reduce((a, b) => a + b, 4);
    }

    return total;
}

/**
 * Count the total amount of tokens that will be used for the API request.
 * @param messages Messages to account for
 * 
 * @returns Total token count
 */
export const countChatMessageTokens = (messages: OpenAIChatMessage[]): number => {
    /* Total amount of tokens used for the chat messages */
    const count: number = getChatMessageLength(...messages);

    /* Add 2 tokens for the metadata. */
    return count + 2;
}