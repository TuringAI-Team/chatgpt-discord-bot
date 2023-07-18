import { Awaitable, ChannelType, GuildBasedChannel, GuildEmoji, GuildMember, Invite, MessageMentions, TextChannel } from "discord.js";

import { DatabaseSubscription, DatabaseUser } from "../../db/schemas/user.js";
import { TuringOpenAIPartialResult } from "../../turing/types/openai/chat.js";
import { ChatGuildData, ModelGenerationOptions } from "../types/options.js";
import { getPromptLength } from "../../conversation/utils/length.js";
import { Conversation } from "../../conversation/conversation.js";
import { ChatOutputImage, ImageBuffer } from "../types/image.js";
import { ModelCapability, ModelType } from "../types/model.js";
import { PartialResponseMessage } from "../types/message.js";
import { DatabasePlan } from "../../db/managers/plan.js";
import { ChatClient, PromptData } from "../client.js";
import { ChatGPTModel } from "./chatgpt.js";
import { Utils } from "../../util/utils.js";

export interface ClydeUser {
    username: string;
    "display name": string | null;
    suffix: string | null;
    "joined Discord at": string;
    "joined the server at": string;
    "Premium subscription": string;
    "Premium pay-as-you-go plan": string;
    "has voted for the bot": string;
    nickname: string | null;
    roles: string | "(none)";
    bot: boolean;
    id: string;
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
    
                /* Search for a GIF using the Tenor API. */
                const results = await conversation.manager.bot.gif.search({ query });
                if (results.length === 0) return "*no GIF found*";

                const chosen = results[0];
                return chosen.url;
            }
        },

        input: {
            match: /[^/]+(?=-gif-)/gm,
            replacer: async (_, __, input) => `<g:${input}>`
        }
    },

    {
        name: "User mentions",

        output: {
            match: /<u:(.*?)>/gm,
            replacer: async (conversation, { guild }, input) => {
                if (input === "<u:SELF>") return `<@${conversation.manager.bot.client.user!.id}>`;

                const username: string = input.replace("<u:", "").replace(">", "");
                const user: GuildMember | null = guild.members.cache.find(m => m.user.username === username) ?? null;

                return user !== null ? `<@${user.id}>` : null;
            }
        },

        input: {
            match: /<@(\d+)>/gm,
            replacer: async (conversation, { guild }, input) => {
                const id: string = input.replace("<@", "").replace(">", "");
                if (id === conversation.manager.bot.client.user!.id) return "<u:SELF>";

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
            name: "Clyde", type: ModelType.Clyde,
            capabilities: [ ModelCapability.GuildOnly, ModelCapability.ImageViewing, ModelCapability.UserLanguage ]
        });
    }

    private async toClydeUser(conversation: Conversation, member: GuildMember, db: DatabaseUser): Promise<ClydeUser> {
        /* Roles of the member */
        const roles = Array.from(member.roles.cache.values());

        /* Final status activity data */
        let final: Partial<ClydeUser> = {};

        final.username = member.user.username;
        final["display name"] = member.user.globalName;
        final.id = member.user.id;

        if (conversation.user.id === member.id) final.suffix = "user I'm talking to";

        const voted: number | null = await this.client.manager.bot.db.users.voted(db);

        const subscription: DatabaseSubscription | null = db.subscription;
        const plan: DatabasePlan | null = db.plan;

        final["Premium subscription"] = subscription !== null ? `yes, joined at ${new Date(subscription.since)} and expires at ${new Date(subscription.expires)}` : "no";
        final["Premium pay-as-you-go plan"] = plan !== null ? `yes, has used up $${plan.used} and a total of $${plan.total} charged up` : "no";
        final["has voted for the bot"] = voted !== null ? `yes, at ${new Date(voted)}` : "no";
        final.bot = member.user.bot;

        final["joined Discord at"] = member.user.createdAt.toISOString();
        if (member.joinedAt) final["joined the server at"] = member.joinedAt.toISOString();

        final.roles = roles.length > 1
            ? roles.filter(r => r.name !== "@everyone").map(r => r.name).join(", ")
            : "none";

        if (member.nickname) final.nickname = member.nickname;

        return final as ClydeUser;
    }

    public async format(conversation: Conversation, guild: ChatGuildData, content: string, type: ClydeFormatterType = "output", partial: boolean = false): Promise<ClydeFormatterResult> {
        /* Final, formatted output string */
        let final: ClydeFormatterResult = {
            text: content, images: []
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

                /* If this was ran on a partially generated message, simply replace it with some placeholder stuff. */
                if (partial) {
                    final.text = final.text.replace(matched, "**...**");

                /* Otherwise, ... */
                } else {
                     /* Formatter results */
                    const result: ClydeFormatterResult | string | null = await formatter.replacer(conversation, guild, matched);

                    if (result !== null) {
                        final.text = final.text.replace(matched, typeof result === "string" ? result : result.text);
                        if (typeof result === "object") final.images.push(...result.images);
                    }
                }
            }
        }

        return final;
    }

    public async complete(options: ModelGenerationOptions): Promise<PartialResponseMessage> {
        /* Clean up the user's prompt; format all channel names, mentions and emoji names. */
        const cleanedPrompt: ClydeFormatterResult = await this.format(options.conversation, options.guild!, options.prompt, "input");

        const progress = async (response: TuringOpenAIPartialResult) => {
            const final: ClydeFormatterResult = await this.format(options.conversation, options.guild!, response.result, "output", true);
            options.progress(final);
        };

        /* All users to include in the prompt */
        const users: ClydeUser[] = [
            await this.toClydeUser(options.conversation, options.guild!.member, options.db.user)
        ];

        const regex: RegExpMatchArray | null = options.prompt.match(MessageMentions.UsersPattern);

        /* Users mentioned in the prompt */
        const userIDs: string[] = regex !== null && regex.length > 0
            ? regex.map(m => m.replace("<@", "").replace(">", "")) : [];

        for (const id of userIDs) {
            /* The guild member instance */
            const member: GuildMember | null = await options.guild!.guild.members.fetch(id).catch(() => null);
            if (member === null) continue;

            /* The user's database instance, if available */
            const db: DatabaseUser | null = await this.client.manager.bot.db.users.getUser(id);
            if (db === null) continue;

            users.push(
                await this.toClydeUser(options.conversation, member, db)
            );
        }

        options.prompt = cleanedPrompt.text;

        const prompt: PromptData = await this.client.buildPrompt<ClydePromptData>(options, { users });
        const data = await this.chat(options, prompt, progress);

        /* Apply the final replacements to the message, e.g. for embedding GIFs and mentiong users correctly. */
        const final: ClydeFormatterResult = await this.format(options.conversation, options.guild!, data.result, "output");

        return {
            raw: {
                finishReason: data.finishReason ? data.finishReason === "length" ? "length" : "stop" : undefined,
                
                usage: {
                    completion: getPromptLength(data.result),
                    prompt: prompt.length
                }
            },

            text: data.result,
            display: final.text,
            images: final.images.length > 0 ? final.images : undefined
        };
    }
}