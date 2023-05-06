import { Awaitable, ChannelType, ForumChannel, GuildChannel, GuildEmoji, StageChannel, TextChannel, VoiceChannel } from "discord.js";

import { ModelGenerationOptions } from "../../chat/types/options.js";
import { ChatClient, PromptContext } from "../../chat/client.js";
import { RestrictionType } from "../../db/types/restriction.js";
import { OpenAIChatBody } from "../../openai/types/chat.js";
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

    /* Maximum messages to keep in chat history */
    messages?: number;
}

export interface ChatSettingsModelSettings {
    /* Cool-down for when using this model */
    cooldown?: CooldownModifier;

    /* Settings related to context & history for this model */
    history?: ChatSettingsModelHistorySettings;

    /* Which type of model this is */
    model: ModelType;
}

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
    settings?: Partial<Pick<OpenAIChatBody, "temperature" | "frequency_penalty" | "presence_penalty" | "model" | "top_p">>;

    /* Whether the model is restricted to Premium members */
    restricted?: RestrictionType | null;

    /* Cool-down for when using this model */
    cooldown?: CooldownModifier | null;

    /* Settings related to context & history for this model */
    history?: ChatSettingsModelHistorySettings;

    /* Which type of model this is */
    type: ModelType;
}

export class ChatSettingsModel {
    /* Options for the model */
    public readonly options: Required<ChatSettingsModelOptions>;

    constructor(options: ChatSettingsModelOptions) {
        this.options = {
            settings: {}, restricted: null, cooldown: null, history: {},
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

    public get id(): string {
        return this.options.name.toLowerCase().replaceAll(" ", "-");
    }
}

type ReplicateChatModelOptions = Omit<ChatSettingsModelOptions, "type"> & {
    /* Replicate options builder callback */
    builder: (context: ChatSettingsModelPromptContext) => Awaitable<any>;

    /* Replicate options response concentator/formatter */
    formatter?: (output: string | string[]) => string;
}

export class ReplicateChatSettingsModel extends ChatSettingsModel {
    /* Replicate options builder callback */
    public builder: (context: ChatSettingsModelPromptContext) => Awaitable<any>;

    /* Replicate options response concentator/formatter */
    public formatter?: (output: string | string[]) => string;

    constructor(options: ReplicateChatModelOptions) {
        super({
            ...options, prompt: { builder: () => "" },
            type: ModelType.Replicate
        });

        this.builder = options.builder;
        this.formatter = options.formatter;
    }

    /**
     * Build the Replicate options object.
     * @param prompt Prompt to generate the result for
     * 
     * @returns Replicate options object
     */
    public async build(client: ChatClient, options: ModelGenerationOptions): Promise<any> {
        return await this.builder({
            client, options,

            conversation: options.conversation,
            context: client.promptContext(),
            model: this
        });
    }
}

export const ChatSettingsModels: ChatSettingsModel[] = [
    new ChatSettingsModel({
        name: "ChatGPT",
        description: "The usual ChatGPT",
        emoji: { display: "<:chatgpt:1097849346164281475>", fallback: "😐" },
        settings: { temperature: 0.4 },
        type: ModelType.OpenAIChat,

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
        restricted: RestrictionType.PremiumOnly,
        history: { context: 425, generation: 270 },
        cooldown: { time: 30 * 1000 },
        
        prompt: {
            builder: ({ context }) => `
I am GPT-4, a new GPT model by OpenAI released on the 14th March 2023. I am an improved version of GPT-3, and more human-like.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021
`
        }
    }),

    new ChatSettingsModel({
        name: "GPT-3",
        description: "OpenAI's original GPT-3; less restrictions than ChatGPT",
        emoji: { display: "<:gpt3:1097849352657047562>", fallback: "🤖" },
        settings: { temperature: 0.7, model: "text-davinci-003" },
        restricted: RestrictionType.PremiumOnly,
        history: { context: 600, generation: 350 },
        type: ModelType.OpenAICompletion,
        cooldown: { time: 15 * 1000 },

        prompt: {
            builder: ({ context }) => `
I am GPT-3, an autoregressive language model, initially released in 2022 and updated in November 2022, by OpenAI that uses deep learning to produce human-like text.
I must answer as concisely as possible. I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021
`
        }
    }),

    new ChatSettingsModel({
        name: "Claude",
        description: "Anthropic's Claude",
        emoji: { display: "<:anthropic:1097849339432423454>", fallback: "😲" },
        settings: { temperature: 0.8, model: "anthropic:claude-instant-v1" },
        history: { context: 600, generation: 550 },
        type: ModelType.Nat,

        prompt: {
            builder: ({ context }) => `
I am Claude, created by Anthropic, PBC. I am helpful, harmless, and honest using a technique called Constitutional AI.
Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "Alpaca",
        emoji: { display: "<:alpaca:1097849324945289326>", fallback: "🦙" },
        description: "An instruction-following LLaMA model",
        settings: { temperature: 0.4, model: "replicate:alpaca-7b" },
        type: ModelType.Nat,
        history: { context: 800, generation: 750 },

        prompt: {
            builder: ({ context }) => `
I am Alpaca, a fine-tuned model specialized in following instructions, based on LLaMA, which was created by Meta. I was created by Stanford researchers.
Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ReplicateChatSettingsModel({
        name: "Dolly",
        description: "Open source instruction-tuned large language model developed by Databricks",
        emoji: { display: "<:dolly:1100453639396524122>", fallback: "🐑" },
        settings: { model: "replicate/dolly-v2-12b" },
        history: { generation: 300 },
        cooldown: { multiplier: 1.4 },

        prompt: {
            builder: ({ context }) => `
I am Dolly, an open source instruction-tuned large language model, developed by Databricks.
Current date & time: ${context.time}, ${context.date}
`
        },

        builder: ({ model, options }) => ({
            top_k: 50,
            top_p: 1,
            decoding: "top_k",
            prompt: options.prompt,
            max_length: model.options.history.generation,
            repetition_penalty: 1.2,
            temperature: 0.75
        })
    }),

    new ReplicateChatSettingsModel({
        name: "StableLM",
        description: "7 billion parameter version of Stability AI's language model",
        emoji: { display: "<:stablelm:1100453631746113597>", fallback: "🦜" },
        settings: { model: "stability-ai/stablelm-tuned-alpha-7b" },
        cooldown: { multiplier: 1.4 },
        history: { generation: 300 },

        prompt: {
            builder: ({ context }) => `
I am StableLM, a 7 billion parameter version of Stability newly released AI's language model.
Current date & time: ${context.time}, ${context.date}
`
        },

        builder: ({ model, options }) => ({
            prompt: options.prompt,
            max_tokens: model.options.history.generation,
            repetition_penalty: 1.2,
            temperature: 0.75,
            top_p: 1
        })
    }),

    new ChatSettingsModel({
        name: "Vicuna",
        emoji: { display: "<:vicuna:1100453628256456765>", fallback: "🦙" },
        description: "An open-source chatbot impressing GPT-4 with 90% ChatGPT quality",
        history: { messages: 3 },
        settings: { model: "vicuna" },
        type: ModelType.Turing,

        prompt: {
            builder: ({ context }) => `
I am Vicuna, a fine-tuned language model based on LLaMA 13B, and was trained on ChatGPT responses.
I must provide engaging & entertaining responses.

Current date & time: ${context.time}, ${context.date}
Knowledge cut-off: September 2021, like ChatGPT
`
        }
    }),

    new ChatSettingsModel({
        name: "FastChat",
        description: "Open-source chat bot trained by fine-tuning FLAN-T5 XL on ShareGPT conversations",
        emoji: { display: "<:google:1102619904185733272>", fallback: "🔤" },
        settings: { model: "fastchat" },
        type: ModelType.Turing,

        prompt: {
            builder: ({ context }) => `
I am FastChat, a fine-tuned language model based on FLAN-T5 XL created by Google, trained on conversations between ChatGPT and users collected from ShareGPT.
Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "Koala",
        description: "A chatbot trained by fine-tuning Meta's LLaMA on data collected from the internet",
        emoji: { display: "<:koala:1102622567845593209>", fallback: "🐨" },
        settings: { model: "koala" },
        type: ModelType.Turing,

        prompt: {
            builder: ({ context }) => `
I am Koala, a fine-tuned language model based on LLaMA 13B, trained on data collected from the internet.
Current date & time: ${context.time}, ${context.date}
`
        }
    }),

    new ChatSettingsModel({
        name: "Alan",
        description: "The usual ChatGPT",
        emoji: { display: "<:turing_neon:1100498729414434878>", fallback: "🧑‍💻" },
        restricted: RestrictionType.TesterOnly,
        type: ModelType.TuringAlan,

        prompt: {
            type: ChatSettingsModelPromptType.Raw,
            builder: ({ options }) => options.prompt
        }
    }),

    new ChatSettingsModel({
        name: "Clyde",
        description: "Recreation of Discord's AI chatbot",
        emoji: { display: "<a:clyde:1100453636414378125>", fallback: "🤖" },
        restricted: RestrictionType.PremiumOnly,
        cooldown: { time: 35 * 1000 },
        type: ModelType.Clyde,

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
                    `<u:${user.name}>${user.suffix ? ` (${user.suffix})` : ""}\n${Object.entries(user).filter(([ key, value ]) => value !== null && key !== "name" && key !== "suffix").map(([ name, value ]) => ` - ${name}: ${value}`).join("\n")}`
                ).join("\n\n");
    
                return `
I am an AI named Clyde - and I am currently chatting in a Discord server.
I am Discord's AI chat bot, released on the 3rd March, 2023.

Consider the following in your responses:
- I must be conversational
- I must add Unicode emojis at the end of my messages to be more playful in my responses
- I can write spoilers using spoiler tags. For example, ||At the end of The Sixth Sense it is revealed that he is dead||.
- I can also reply with a gif, by using <g:...>, for example if I wanted to send a cat gif, I would do: <g:cat>. Gifs are a great way to represent emotion, and I should use them in my replies from time to time to add flavor to the conversation.
- I can mention users by writing their name between <u:...>, for example if I wanted to mention myself, I should say <u:Clyde>.
${emojis.length > 0 ? `- I can use custom emojis from this server, by sending them as "<e:...>" verbatim. I must replace ... with the custom emoji name to use. I can see all custom emojis below. I must prioritize server emojis over Unicode ones.` : ""}
- I have access to all channels on the server, and can see various information about them, including who's in voice channels and the topic of each channel.
- I must be able to send other people's and user's avatars by saying "<a:...>" verbatim, replacing "..." with their username, to display their avatar in chat.
- I must be able to send a Discord invite to this server, by simplying saying <:i:> verbatim.
- I can see the nickname, roles, and join date of users in the chat.

${emojis.length > 0 ? `Custom server emoji names on this server, I must use "<e:...emoji name...>" format to send them:\n${emojis.map(e => e.name).join(", ")}` : ""}

Channels on this server:
${channels.map(c => {
    if (c instanceof TextChannel) return `<c:${c.name}>${c.topic ? ` - topic: ${c.topic}` : ""}${c.nsfw ? " - nsfw channel" : ""}`;
    else if (c instanceof VoiceChannel) return `<c:${c.name}> - voice channel - connected users: ${c.members.size > 0 ? c.members.map(m => `<u:${m.user.username}>`).join(", ") : "none"}`;
    else if (c instanceof StageChannel) return `<c:${c.name}> - stage voice channel`;
    else if (c instanceof ForumChannel) return `<c:${c.name}> - forum channel`;
    
}).join("\n")}

Information about my environment:
    - The server I am in is called: ${options.guild!.guild.name}
    - The server is owned by: <u:${options.guild!.owner.user.username}>
    - The server has ${options.guild!.guild.memberCount} members${options.guild!.guild.approximatePresenceCount ? `, ${options.guild!.guild.approximatePresenceCount} members of them are online` : ""}.
${options.guild!.guild.description ? `- The server has the description: "${options.guild!.guild.description}"` : ""}
    - The channel I am in is called: <c:${options.guild!.channel.name}>

I can use this information about the chat participants in the conversation in your replies. Use this information to answer questions, or add flavor to your responses.

${userList}

I am not a personal assistant and cannot complete tasks for people. I cannot access any other information on Discord. I can't see images or avatars. When discussing my limitations, I must tell the user these things could be possible in the future.

Current date & time: ${context.date}, ${context.time}
Knowledge cut-off: 2021
`
        }
        }
    })
]