import { Awaitable, ChannelType, ForumChannel, GuildChannel, GuildEmoji, StageChannel, TextChannel, VoiceChannel } from "discord.js";

import { TuringOpenAIChatBody } from "../../turing/types/openai/chat.js";
import { UserPlanCreditBonusAmount } from "../../db/managers/plan.js";
import { ModelGenerationOptions } from "../../chat/types/options.js";
import { ChatClient, PromptContext } from "../../chat/client.js";
import { RestrictionType } from "../../db/types/restriction.js";
import { CooldownModifier } from "../utils/cooldown.js";
import { ClydeUser } from "../../chat/models/clyde.js";
import { ModelType } from "../../chat/types/model.js";
import { DisplayEmoji } from "../../util/emoji.js";
import { Conversation } from "../conversation.js";

export type ChatSettingsModelPromptBuilder = (context: ChatSettingsModelPromptContext) => Awaitable<string>

export enum ChatSettingsModelPromptType {
    /** Passing the generated prompt to the model verbatim */
    Raw,

    /** Build the prompt with history, context & other stuff */
    Full
}

export interface ChatSettingsModelPromptContext {
    client: ChatClient;
    conversation: Conversation;
    options: ModelGenerationOptions;
    model: ChatSettingsModel;
    context: PromptContext;
    data?: any;
}

export interface ChatSettingsModelHistorySettings {
    /* Maximum context length, in tokens */
    context?: number;

    /* Maximum generation length, in tokens */
    generation?: number;

    /* Maximum amount of tokens this model supports */
    maxTokens: number;

    /* Maximum messages to keep in chat history */
    messages?: number;
}

export enum ChatSettingsModelBillingType {
    /* The specified amount is billed per 1000 tokens, including prompt & completion tokens */
    Per1000Tokens,

    /* The specified amount is billed every second of generation */
    PerSecond,

    /* The specified amount is billed fixed for each message */
    PerMessage,

    /* The chat model doesn't cost anything */
    Free,

    /* The amount will be given once the message has finished generating */
    Custom
}

export interface ChatSettingsModelBillingTokenBilling {
    /* How much money to charge for completion tokens */
    prompt: number;

    /* How much credit to charge for completion tokens */
    completion: number;
}

export interface ChatSettingsModelBillingSettings {
    /* Type of billing to do */
    type: ChatSettingsModelBillingType;

    /* How much credit to charge, depending on the type */
    amount: ChatSettingsModelBillingTokenBilling | number;

    /* How much % to take as a "bonus" */
    extra?: UserPlanCreditBonusAmount;
}

export type ChatSettingsModelAdditionalSettings = Partial<Pick<TuringOpenAIChatBody, "temperature" | "model" | "top_p">>

export declare interface ChatSettingsModelOptions {
    /* Name of the model */
    name: string;

    /* Emoji for the model */
    emoji: DisplayEmoji;

    /* Description of the model */
    description: string;

    /* Pre-prompt builder for the model */
    prompt: {
        builder: ChatSettingsModelPromptBuilder;
        type?: ChatSettingsModelPromptType
    };

    /* Model generation settings */
    settings?: ChatSettingsModelAdditionalSettings;

    /* Whether the model is restricted to Premium members */
    restricted?: RestrictionType | null;

    /* Cool-down for when using this model */
    cooldown?: CooldownModifier | null;

    /* Settings related to context & history for this model */
    history?: ChatSettingsModelHistorySettings;

    /* Settings related to billing for the pay-as-you-go plan */
    billing: ChatSettingsModelBillingSettings;

    /* Which type of model this is */
    type: ModelType;
}

export class ChatSettingsModel {
    /* Options for the model */
    public readonly options: Required<ChatSettingsModelOptions>;

    constructor(options: ChatSettingsModelOptions) {
        this.options = {
            settings: {}, restricted: null, cooldown: null, history: { maxTokens: 1024 },
            ...options
        };
    }

    /**
     * Get the formatted model pre-prompt.
     * @param conversation Specific conversation for the model
     * 
     * @returns Formatted model pre-prompt
     */
    public async format(context: Pick<ChatSettingsModelPromptContext, "conversation" | "options" | "client" | "data">): Promise<string> {
        return this.options.prompt.builder({
            ...context,

            context: context.client.promptContext(),
            model: this
        });
    }

    public get premiumOnly(): boolean {
        return this.options.restricted === "plan" || this.options.restricted === "subscription" || this.options.restricted === "premium";
    }

    public get id(): string {
        return this.options.name.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "-").toLowerCase();
    }
}

export const ChatSettingsModels: ChatSettingsModel[] = [
    new ChatSettingsModel({
        name: "ChatGPT",
        description: "The usual ChatGPT",
        emoji: { display: "<:chatgpt:1097849346164281475>", fallback: "🤖" },
        settings: { temperature: 0.4 },
        history: { maxTokens: 4096 },
        type: ModelType.OpenAIChat,

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: {
                prompt: 0.0015,
                completion: 0.002
            }
        },

        prompt: {
            builder: ({ context }) => `
I am ChatGPT, a large language model trained by OpenAI, released in November 2022.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021
`
        }
    }),

    new ChatSettingsModel({
        name: "GPT-4",
        description: "OpenAI's new GPT-4 model",
        emoji: { fallback: "✨" },
        settings: { model: "gpt-4" },
        type: ModelType.OpenAIChat,
        restricted: "premium",
        history: { context: 425, generation: 270, maxTokens: 8192 },
        cooldown: { time: 30 * 1000 },

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: {
                prompt: 0.03,
                completion: 0.06
            }
        },
        
        prompt: {
            builder: ({ context }) => `
I am GPT-4, a new GPT model by OpenAI released on the 14th March 2023. I am an improved version of ChatGPT, and provide more advanced and complex replies.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021
`
        }
    }),

    new ChatSettingsModel({
        name: "ChatGPT 16K",
        description: "The usual ChatGPT, with higher context & generation limits",
        emoji: { display: "<:chatgpt_16k:1118928845244989500>", fallback: "🔥" },
        settings: { model: "gpt-3.5-turbo-16k", temperature: 0.4 },
        history: { maxTokens: 16384 },
        type: ModelType.OpenAIChat,
        restricted: "plan",

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: {
                prompt: 0.003, completion: 0.004
            }
        },

        prompt: {
            builder: ({ context }) => `
I am ChatGPT, a large language model trained by OpenAI, released in November 2022.
I must provide engaging & entertaining responses.

I am a special version of ChatGPT: I have the ability to store larger chat history context & generate longer answers, if the user configures the token limits in \`/settings me\` or \`/settings server\` accordingly.
My total context generation limit is 16.384 tokens.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021
`
        }
    }),

    new ChatSettingsModel({
        name: "Claude",
        emoji: { display: "<:anthropic:1097849339432423454>", fallback: "🆑" },
        description: "Next-generation AI assistant by Anthropic",
        settings: { model: "claude-instant-1-100k" },
        history: { maxTokens: 100000 },
        cooldown: { multiplier: 1.5 },
        type: ModelType.Anthropic,

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: {
                completion: 0.00551,
                prompt: 0.00163
            }
        },

        prompt: {
            builder: ({ context }) => `
I am Claude, an AI chatbot created by Anthropic.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "Claude 2",
        emoji: { display: "<:anthropic:1097849339432423454>", fallback: "🆑" },
        description: "Second version of Anthropic's AI assistant",
        settings: { model: "claude-2" },
        history: { maxTokens: 100000 },
        restricted: "plan",
        type: ModelType.Anthropic,

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: {
                completion: 0.03268,
                prompt: 0.01102
            }
        },

        prompt: {
            builder: ({ context }) => `
I am Claude, an AI chatbot created by Anthropic.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "PaLM 2",
        emoji: { display: "<:palm:1125109625998553181>", fallback: "🌴" },
        description: "Next-generation large language model by Google",
        settings: { model: "chat-bison" },
        history: { maxTokens: 1025 },
        cooldown: { multiplier: 0.5 },
        type: ModelType.Google,

        billing: {
            type: ChatSettingsModelBillingType.PerMessage,
            amount: 0.004
        },

        prompt: {
            builder: ({ context }) => `
You are PaLM 2, an AI chatbot created by Google.
You must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "Alan",
        description: "A combination of various AIs, creating the ultimate chatbot",
        emoji: { display: "<:turing_logo:1114952278483411095>", fallback: "🧑‍💻" },
        cooldown: { time: 1.5 * 60 * 1000 },
        type: ModelType.Alan,
        history: { maxTokens: 1024 },

        billing: {
            type: ChatSettingsModelBillingType.Custom, amount: 0
        },

        prompt: {
            type: ChatSettingsModelPromptType.Raw,
            builder: ({ options }) => options.prompt
        }
    }),

    new ChatSettingsModel({
        name: "Clyde",
        description: "Recreation of Discord's AI chatbot",
        emoji: { display: "<a:clyde:1100453636414378125>", fallback: "🤖" },
        restricted: "plan",
        cooldown: { time: 35 * 1000 },
        history: { maxTokens: 4097 },
        type: ModelType.Clyde,

        billing: {
            type: ChatSettingsModelBillingType.Per1000Tokens,
            amount: 0.002
        },

        prompt: {
            builder: ({ options, context, data }) => {
                /* All custom emojis on the guild */
                const emojis: GuildEmoji[] = Array.from(options.guild!.guild.emojis.cache.values())
                    .slice(undefined, 25);
    
                /* All text channels on the guild */
                const channels: GuildChannel[] = Array.from(options.guild!.guild.channels.cache.values())
                    .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
                    .slice(undefined, 15) as GuildChannel[];
    
                const userList: string = data.users.map((user: ClydeUser) =>
                    `<u:${user.username}>${user.suffix ? ` (${user.suffix})` : ""}\n${Object.entries(user).filter(([ key, value ]) => value !== null && key !== "name" && key !== "suffix").map(([ name, value ]) => ` - ${name}: ${value}`).join("\n")}`
                ).join("\n\n");
    
                return `
I am an AI named Clyde - and I am currently chatting in a Discord server.
I am Discord's AI chat bot, released on the 3rd March, 2023.

Consider the following in your responses:
- I must be conversational
- I must add Unicode emojis at the end of my messages to be more playful in my responses
- I can write spoilers using spoiler tags. For example, ||At the end of The Sixth Sense it is revealed that he is dead||.
- I can also reply with a gif, by using <g:...>, for example if I wanted to send a cat gif, I would do: <g:cat>. Gifs are a great way to represent emotion, and I should use them in my replies from time to time to add flavor to the conversation.
- I can mention users by writing their name between <u:...>, for example if I wanted to mention myself, I should say <u:SELF>.
${emojis.length > 0 ? `- I can use custom emojis from this server, by sending them as "<e:...>" verbatim. I must replace ... with the custom emoji name to use. I can see all custom emojis below. I must prioritize server emojis over Unicode ones.` : ""}
- I have access to all channels on the server, and can see various information about them, including who's in voice channels and the topic of each channel.
- I must be able to send other people's and user's avatars by saying "<a:...>" verbatim, replacing "..." with their username, to display their avatar in chat.
- I must be able to send a Discord invite to this server, by simplying saying <:i:> verbatim.
- I can see the nickname, roles, and join date of users in the chat.

${emojis.length > 0 ? `Custom server emoji names on this server, I must use "<e:...emoji name...>" format to send them:\n${emojis.map(e => e.name).join(", ")}` : ""}

Channels on this server:
${channels.map(c => {
    if (c instanceof TextChannel) return `<c:${c.name}>${c.topic ? ` - topic: ${c.topic}` : ""}${c.nsfw ? " - NSFW channel" : ""}`;
    else if (c instanceof VoiceChannel) return `<c:${c.name}> - voice channel - connected users: ${c.members.size > 0 ? c.members.map(m => `<u:${m.user.username}>`).join(", ") : "none"}`;
    else if (c instanceof StageChannel) return `<c:${c.name}> - stage voice channel`;
    else if (c instanceof ForumChannel) return `<c:${c.name}> - forum channel`;
    else return `<c:${c.name}> - misc. channel`;
}).join("\n")}

Information about my environment:
    - The server I am in is called: ${options.guild!.guild.name}
    - The server is owned by: <u:${options.guild!.owner.user.username}>
    - The server has ${options.guild!.guild.memberCount} members${options.guild!.guild.approximatePresenceCount ? `, ${options.guild!.guild.approximatePresenceCount} members of them are online` : ""}.
${options.guild!.guild.description ? `- The server has the description: "${options.guild!.guild.description}"` : ""}
    - The channel I am in is called: <c:${options.guild!.channel.name}>

I can use this information about the chat participants in the conversation in my replies. I will use this information to answer questions, or add flavor to my responses.

${userList}

I am not a personal assistant and cannot complete tasks for people. I cannot access any other information on Discord. When discussing my limitations, I must tell the user these things could be possible in the future.

Current date & time: ${context.date}, ${context.time}
Knowledge cut-off: 2021
`
            }
        }
    })
]