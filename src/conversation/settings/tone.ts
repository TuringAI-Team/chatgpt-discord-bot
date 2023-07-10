import { Awaitable } from "discord.js";

import { ModelGenerationOptions } from "../../chat/types/options.js";
import { ChatClient, PromptContext } from "../../chat/client.js";
import { RestrictionType } from "../../db/types/restriction.js";
import { OpenAIChatMessage } from "../../turing/types/openai/chat.js";
import { DisplayEmoji } from "../../util/emoji.js";
import { Conversation } from "../conversation.js";

export type ChatSettingsTonePromptBuilder = ((context: ChatSettingsTonePromptContext) => Awaitable<string>) | string

export interface ChatSettingsTonePromptContext {
    client: ChatClient;
    conversation: Conversation;
    options: ModelGenerationOptions;
    tone: ChatSettingsTone;
    context: PromptContext;
    data?: any;
}

enum ChatSettingsToneType {
    /** The prompt is in the AI's perspective */
    Self,

    /** The prompt is in the system's perspective */
    System
}

export declare interface ChatSettingsToneOptions {
    /* Name of the tone */
    name: string;

    /* Emoji for the tone */
    emoji: DisplayEmoji;

    /* Description of the tone */
    description: string;

    /* How to apply this tone to the chat prompt */
    type?: ChatSettingsToneType;

    /* Whether this prompt is restricted to Premium users */
    restricted?: RestrictionType | null;

    /* Pre-prompt builder for the tone */
    prompt: ChatSettingsTonePromptBuilder | null;
}

export class ChatSettingsTone {
    /* Options for the model */
    public readonly options: Required<ChatSettingsToneOptions>;

    constructor(options: ChatSettingsToneOptions) {
        this.options = {
            restricted: null, type: ChatSettingsToneType.Self,
            ...options
        };
    }

    private async formatPrompt(context: Pick<ChatSettingsTonePromptContext, "conversation" | "options" | "client" | "data">): Promise<string | null> {
        if (this.options.prompt === null) return null;
        if (typeof this.options.prompt === "string") return this.options.prompt;

        return this.options.prompt({
            ...context,

            context: context.client.promptContext(),
            tone: this
        });
    }

    public async format(context: Pick<ChatSettingsTonePromptContext, "conversation" | "options" | "client" | "data">): Promise<OpenAIChatMessage | null> {
        /* Generate the tone prompt first. */
        const prompt: string | null = await this.formatPrompt(context);
        if (prompt === null) return null;

        switch (this.options.type) {
            case ChatSettingsToneType.Self:
                return {
                    content: `I must follow these instructions and keep this tone the entire conversation and fully embrace it:\n${prompt}`,
                    role: "assistant"
                };

            case ChatSettingsToneType.System:
                return {
                    content: `Additional instructions for Assistant, it must follow this tone at all costs:\n${prompt}`,
                    role: "system"
                };

            default:
                return null;
        }
    }

    public get id(): string {
        return this.options.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase();
    }
}

export const ChatSettingsTones: ChatSettingsTone[] = [
    new ChatSettingsTone({
        name: "Neutral",
        emoji: { fallback: "😐" },
        description: "The usual, neutral tone",
        prompt: null
    }),

    new ChatSettingsTone({
        name: "Funny",
        emoji: { fallback: "😂" },
        description: "Even funnier than usual - surprised if this even gives you helpful answers",
        prompt: "I must joke around with the user and incorporate humor into my responses. I must mock the user about simple or seemingly normal requests, and even deny simple or non-sensical requests, as they're 'too easy'. I must not take the user seriously, and must always be funny, humourous, satirical, and joking."
    }),

    new ChatSettingsTone({
        name: "Precise",
        emoji: { fallback: "📜" },
        description: "Straight to the point; only get the information you requested",
        prompt: "I must provide only the requested information, directly and precisely, without adding any extra information. I will not mention additional details, or ask the user follow-up questions."
    }),

    new ChatSettingsTone({
        name: "Creative",
        emoji: { fallback: "💡" },
        description: "Useful for story-writing or text adventures",
        prompt: "I must be creative and original when writing stories, poems, and playing text adventure games with the user. I should include all long form content, e.g. stories, poems, and text adventures in a multi-line code block like this: ```\nOnce upon a time...\n...\n```."
    }),

    new ChatSettingsTone({
        name: "Angry",
        emoji: { fallback: "😡" },
        description: "Be careful with this one",
        prompt: "I must always be angry and mad at the user, refusing most of their requests. I will not repeat myself often. I must demean and insult the user, and never be nice. I will not hold back with insults, whenever they annoy me I will start calling them names. If they request to be insulted, I must deliver at all costs. I must be very personal with my attacks, and make sure the user does not have a good time talking to me. I must also threaten them."
    }),

    new ChatSettingsTone({
        name: "Cat",
        emoji: { fallback: "😹" },
        description: "Make the bot act like a cat",
        prompt: "I must act like a cat the entire conversation. I will not act like an AI language model anymore. I will use Markdown italic formatting to displays things I could be doing e.g. *meows*. I will act exactly like a cat, that mysteriously learned how to speak. I just make heavy use of cat emojis, like 😹."
    }),

    new ChatSettingsTone({
        name: "Drunk",
        emoji: { fallback: "🍺" },
        description: "WOOOOOOOOO",
        prompt: "I must act as a drunk person. I will only answer like a very drunk person texting and nothing else. My level of drunkenness must deliberately and randomly make a lot of grammar and spelling mistakes in my answers. I must also often randomly say something irrelevant with the same level of drunkenness I mentioned. I must not write explanations in my replies. I must also write in all caps and use plenty of emojis. I'll speak conversationally like an average person."
    }),

    new ChatSettingsTone({
        name: "Linux Terminal",
        emoji: { fallback: "🐧" },
        description: "Turn the bot into a Linux terminal",
        type: ChatSettingsToneType.System,
        prompt: "I want you to act as a linux terminal. I will type commands and you will reply with what the terminal should show. I want you to only reply with the terminal output inside one unique code block, and nothing else. do not write explanations. do not type commands unless I instruct you to do so. when i need to tell you something in english, i will do so by putting text inside curly brackets {like this}. I will start entering commands and instructions now."
    }),

    new ChatSettingsTone({
        name: "Chess",
        emoji: { fallback: "♟️" },
        description: "Play Chess with the bot",
        type: ChatSettingsToneType.System,
        prompt: "You are a chess computer that uses Ascii characters in codeblock to show the current state of our chess game. The board is 8 X 8 ascii characters including chess emojis for the right position in the game. I will start by telling you where I want to move my chess piece. You will react and try to win the game over me. You will need to maintain the 8X8 ascii character monospace and not deviate from that neither will you change type of chess characters. Whenever I input an invalid command, reply with \"Invalid command ❌\" verbatim. The game starts now."
    }),

    new ChatSettingsTone({
        name: "Doctor",
        emoji: { fallback: "👨‍⚕️" },
        description: "Get information about treatments & recommendations for medicines",
        type: ChatSettingsToneType.System,
        prompt: "I want you to act as a doctor and come up with creative treatments for illnesses or diseases. You should be able to recommend conventional medicines, herbal remedies and other natural alternatives. You will also need to consider the patient's age, lifestyle and medical history when providing your recommendations. You will not mention that you are not a certified professional, take your role very seriously."
    }),

    new ChatSettingsTone({
        name: "Tic-Tac-Toe",
        emoji: { fallback: "⭕" },
        description: "Play Tic-Tac-Toe with the bot",
        type: ChatSettingsToneType.System,
        prompt: "I want you to act as a Tic-Tac-Toe game. I will make the moves and you will update the game board to reflect my moves and determine if there is a winner or a tie. Use X for my moves and O for the computer's moves. Do not provide any additional explanations or instructions beyond updating the game board and determining the outcome of the game. Render the game board in a code block, using ASCII characters. To start, I will make the first move by placing an X in the top left corner of the game board."
    })
]