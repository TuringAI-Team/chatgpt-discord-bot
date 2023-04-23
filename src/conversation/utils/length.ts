import { get_encoding } from "@dqbd/tiktoken";
export const encoder = get_encoding("cl100k_base");

import { OpenAIChatMessage } from "../../openai/types/chat.js";

/* Maximum generation length in total,*/
export const GPT_MAX_CONTEXT_LENGTH = {
    Free: 670,
    Voter: 690,
    GuildPremium: 725,
    UserPremium: 1100
}

/* Maximum generation length in total */
export const GPT_MAX_GENERATION_LENGTH = {
    Free: 300,
    Voter: 350,
    GuildPremium: 600,
    UserPremium: 1000
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

/**
 * Count the total amount of tokens that will be used for the API request.
 * @param messages Messages to account for
 * 
 * @returns Total token count
 */
export const countChatMessageTokens = (messages: OpenAIChatMessage[]): number => {
    /* Map each message to the number of tokens it contains. */
    const messageTokenCounts = messages.map((message) => {
        /* Map each property of the message to the number of tokens it contains. */
        const propertyTokenCounts = Object.entries(message).map(([_, value]) => {
            /* Count the number of tokens in the property value. */
            return getPromptLength(value);
        });

        /* Sum the number of tokens in all properties and add 4 for metadata. */
        return propertyTokenCounts.reduce((a, b) => a + b, 4);
    });

    /* Sum the number of tokens in all messages and add 2 for metadata. */
    return messageTokenCounts.reduce((a, b) => a + b, 2);
}