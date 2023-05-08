import { Awaitable, ChannelType, GuildBasedChannel, GuildEmoji, GuildMember, Invite, TextChannel } from "discord.js";

import { OpenAIChatCompletionsData, OpenAIPartialCompletionsJSON } from "../../openai/types/chat.js";
import { DatabaseSubscription, DatabaseUser } from "../../db/managers/user.js";
import { ChatGuildData, ModelGenerationOptions } from "../types/options.js";
import { Conversation } from "../../conversation/conversation.js";
import { ChatOutputImage, ImageBuffer } from "../types/image.js";
import { ModelCapability, ModelType } from "../types/model.js";
import { PartialResponseMessage } from "../types/message.js";
import { ChatClient, PromptData } from "../client.js";
import { ChatGPTModel } from "./chatgpt.js";
import { Utils } from "../../util/utils.js";

export interface ClydeUser {
    name: string;
    suffix: string | null;
    "joined discord at": string;
    "joined the server at": string;
    "has premium subscription": string;
    "has voted for the bot": string;
    nickname: string | null;
    roles: string | null;
}

export interface ClydePromptData {
    users: ClydeUser[];
}

type ClydeReplacer = (conversation: Conversation, guild: ChatGuildData, input: string) => Awaitable<ClydeFormatterResult | string | null>
type ClydeFormatterType = "input" | "output"

interface ClydeFormatter {
    /* RegEx's to match */
    match: RegExp;

    /* The replacement callbacks to replace the matched string */
    replacer: ClydeReplacer;
}

interface ClydeFormatterResult {
    text: string;
    images: ChatOutputImage[];
}

type ClydeFormatterPair = Partial<Record<ClydeFormatterType, ClydeFormatter>> & {
    /* Name of this formatter pair */
    name: "GIFs" | "User mentions" | "Custom emojis" | "Guild invite" | "Channels" | "Avatars";
};

const ClydeFormatters: ClydeFormatterPair[] = [
    {
        name: "GIFs",

        output: {
            match: /<g:(.*?)>/gm,
            replacer: async (conversation, _, input) => {
                /* Search query to use for Tenor */
                const query: string = input.replace("<g:", "").replace(">", "");
    
                /* Search for a GIF using the GIPHY API. */
                const { data: results } = await conversation.manager.bot.gif.search(query);
                const chosen = results[0];
                
                return chosen.url;
            }
        },

        input: {
            match: /(https?:\/\/giphy\.com\/gifs\/([\w-]+))/gm,
            replacer: async (_, __, input) => {
                return input.replace("https://giphy.com/gifs/", "");
            }
        }
    },

    {
        name: "User mentions",

        output: {
            match: /<u:(.*?)>/gm,
            replacer: async (_, { guild }, input) => {
                const username: string = input.replace("<u:", "").replace(">", "");
    
                const user: GuildMember | null = guild.members.cache.find(m => m.user.username === username) ?? null;
                return user !== null ? `<@${user.id}>` : null;
            }
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: async (_, { guild }, input) => {
                const id: string = input.replace("<@", "").replace(">", "");

                const user: GuildMember | null = guild.members.cache.find(m => m.user.id === id) ?? null;
                return user !== null ? `<u:${user.user.username}>` : null;
            }
        }
    },

    {
        name: "Custom emojis",

        output: {
            match: /<e:(.*?)>/gm,
            replacer: async (_, { guild }, input) => {
                /* Name of the custom emoji */
                const name: string = input.replace("<e:", "").replace(">", "");
    
                /* Matching guild emoji */
                const emoji: GuildEmoji | null = guild.emojis.cache.find(e => e.name === name) ?? null;
                return emoji !== null ? emoji.toString() : null;
            }
        },

        input: {
            match: /<(a)?:([\w_]+):(\d+)>/gm,
            replacer: async (_, { guild }, input) => {
                const [ name, id ] = input.replace("<a:", "").replace("<:", "").replace(">", "").split(":");
                if (!name || !id) return null;
    
                /* Matching guild emoji */
                const emoji: GuildEmoji | null = guild.emojis.cache.find(e => e.id === id) ?? null;
                return emoji !== null ? `<e:${emoji.name}>` : null;
            }
        }
    },

    {
        name: "Channels",

        output: {
            match: /<c:(.*?)>/gm,
            replacer: async (_, { guild }, input) => {
                const name: string = input.replace("<c:", "").replace(">", "");
    
                const channel: GuildBasedChannel | null = guild.channels.cache.find(c => c.name === name && c.type !== ChannelType.GuildCategory) ?? null;
                return channel !== null ? `<#${channel.id}>` : null;
            }
        },

        input: {
            match: /<#(\d+)>/gm,
            replacer: async (_, { guild }, input) => {
                const id: string = input.replace("<#", "").replace(">", "");
    
                const channel: GuildBasedChannel | null = guild.channels.cache.find(c => c.id === id) ?? null;
                return channel !== null ? `<c:${channel.name}>` : null;
            }
        }
    },

    {
        name: "Guild invite",

        output: {
            match: /<:i:>/gm,
            replacer: async (_, { guild, channel }) => {
                try {
                    /* All invites on the server */
                    const invites: Invite[] = Array.from(
                        await guild.invites.fetch()
                            .then(invites => invites.values())
                            .catch(() => [])
                    );

                    /* Pick a random invite; or generate a new one. */
                    const invite: Invite | null = invites.length > 0
                        ? Utils.random(invites)
                        : await guild.invites.create(channel as TextChannel).catch(() => null);

                    return invite ? `https://discord.gg/${invite.code}` : null;
                    
                } catch (_) { return "*no invites* :pensive:"; }
            }
        },
    },
    
    {
        name: "Avatars",

        output: {
            match: /<a:(.*?)>/gm,

            replacer: async (_, { guild }, input) => {
                const username: string = input.replace("<a:", "").replace(">", "");
    
                const user: GuildMember | null = guild.members.cache.find(m => m.user.username === username) ?? null;
                if (user === null) return "*no avatar*";

                const buffer: ImageBuffer | null = await Utils.fetchBuffer(user.displayAvatarURL());
                if (buffer === null) return "*failed to load avatar*";

                return {
                    text: `<@${user.id}>`,
                    images: [ {
                        prompt: `${user.nickname ?? user.user.username}'s avatar`,
                        data: buffer
                    } ]
                };
            }
        }
    }
]

export class ClydeModel extends ChatGPTModel {
    constructor(client: ChatClient) {
        super(client, {
            name: "Clyde",
            type: ModelType.Clyde,

            capabilities: [ ModelCapability.GuildOnly, ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    /**
     * Display the presence & activity status of a guild member. 
     */
    private toClydeUser(conversation: Conversation, member: GuildMember, db: DatabaseUser): ClydeUser {
        /* Roles of the member */
        const roles = Array.from(member.roles.cache.values());

        /* Final status activity data */
        let final: Partial<ClydeUser> = {};

        final.name = member.user.username;
        if (conversation.user.id === member.id) final.suffix = "user I'm talking to";

        const voted: number | null = this.client.session.manager.bot.db.users.voted(db);
        const subscription: DatabaseSubscription | null = db.subscription;

        final["has premium subscription"] = subscription !== null ? `yes, joined at ${new Date(subscription.since)} and expires at ${new Date(subscription.expires)}` : "no";
        final["has voted for the bot"] = voted !== null ? `yes, at ${new Date(voted)}` : "no";

        final["joined discord at"] = member.user.createdAt.toISOString();
        if (member.joinedAt) final["joined the server at"] = member.joinedAt.toISOString();

        final.roles = roles.length > 1
            ? roles.filter(r => r.name !== "@everyone").map(r => r.name).join(", ")
            : null;

        if (member.nickname) final.nickname = member.nickname;

        return final as ClydeUser;
    }

    public async format(conversation: Conversation, guild: ChatGuildData, content: string, type: ClydeFormatterType = "output"): Promise<ClydeFormatterResult> {
        /* Final, formatted output string */
        let final: ClydeFormatterResult = {
            text: content,
            images: []
        };

        /* Apply all formatters. */
        for (const pair of ClydeFormatters.filter(formatter => formatter[type] !== undefined)) {
            const formatter: ClydeFormatter = pair[type]!;

            /* Find all matches in the string, for this formatter. */
            const matches = Array.from(final.text.matchAll(formatter.match));
            if (matches === null || matches.length === 0) continue;

            for (const match of matches) {
                /* Which string actually matched & we want to use */
                const matched: string = match[0];

                /* Formatter results */
                const result: ClydeFormatterResult | string | null = await formatter.replacer(conversation, guild, matched);

                if (result !== null) {
                    final.text = final.text.replace(matched, typeof result === "string" ? result : result.text);
                    if (typeof result === "object") final.images.push(...result.images);
                }
            }
        }

        return final;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Clean up the user's prompt; format all channel names, mentions and emoji names. */
        const cleanedPrompt: ClydeFormatterResult = await this.format(options.conversation, options.guild!, options.prompt, "input");
        options.prompt = cleanedPrompt.text;

        const progress = async (response: OpenAIPartialCompletionsJSON) => {
            options.progress({ text: response.choices[0].delta.content! });
        };

        /* All users to include in the prompt */
        const users: ClydeUser[] = [
            this.toClydeUser(options.conversation, options.guild!.member, options.db.user)
        ];

        const prompt: PromptData = await this.client.buildPrompt<ClydePromptData>(options, { users });
        const data: OpenAIChatCompletionsData = await this.chat(options, prompt, progress);

        /* Apply the final replacements to the message, e.g. for embedding GIFs and mentiong users correctly. */
        const final: ClydeFormatterResult = await this.format(options.conversation, options.guild!, data.response.message.content, "output");

        return {
            raw: {
                finishReason: data.response.finish_reason ? data.response.finish_reason === "length" ? "maxLength" : "stop" : null,
                
                usage: {
                    completion: data.usage.completion_tokens,
                    prompt: data.usage.prompt_tokens
                }
            },

            text: data.response.message.content,
            display: final.text,
            images: final.images.length > 0 ? final.images : undefined
        };
    }
}