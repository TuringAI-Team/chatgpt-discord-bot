import { APIApplicationCommandOptionChoice, ActionRow, ActionRowBuilder, Awaitable, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ComponentEmojiResolvable, GuildMember, Interaction, InteractionReplyOptions, InteractionUpdateOptions, ModalBuilder, SelectMenuComponentOptionData, StringSelectMenuBuilder, StringSelectMenuInteraction, TextChannel, TextInputBuilder, TextInputStyle, ChatInputCommandInteraction, Guild, Role, Snowflake } from "discord.js";
import { randomUUID } from "crypto";
import chalk from "chalk";

import { TuringAlanImageGenerators, TuringAlanImageModifiers, TuringAlanSearchEngines, alanOptions } from "../../turing/api.js";
import { ConversationDefaultCooldown, Conversation } from "../../conversation/conversation.js";
import { LoadingIndicatorManager, LoadingIndicators } from "../types/indicator.js";
import { ChatSettingsPlugins } from "../../conversation/settings/plugin.js";
import { InteractionHandlerResponse } from "../../interaction/handler.js";
import { ChatSettingsModels } from "../../conversation/settings/model.js";
import { ChatSettingsTones } from "../../conversation/settings/tone.js";
import { DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { DatabaseSettings, DatabaseUser } from "../schemas/user.js";
import { ImagePromptEnhancers } from "../../image/types/prompt.js";
import { ErrorResponse } from "../../command/response/error.js";
import { ImageConfigModels } from "../../image/types/model.js";
import { ChatGuildData } from "../../chat/types/options.js";
import { RestrictionType } from "../types/restriction.js";
import { DisplayEmoji, Emoji } from "../../util/emoji.js";
import { ImageStyles } from "../../image/types/style.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { Response } from "../../command/response.js";
import { DatabaseGuild } from "../schemas/guild.js";
import { AppDatabaseManager } from "../app.js";
import { SubDatabaseManager } from "../sub.js";
import { UserLanguages } from "../types/locale.js";
import { Utils } from "../../util/utils.js";
import { DatabaseInfo } from "./user.js";
import { Bot } from "../../bot/bot.js";

export enum SettingsLocation {
    Guild = "guild",
    User = "user",
    Both = "both"
}

export type SettingsDatabaseEntry = DatabaseUser | DatabaseGuild

export interface SettingsCategory {
    /** Type of the category */
    type: SettingsCategoryName;

    /** Display name of the category */
    name: string;

    /** Emoji for this category */
    emoji: DisplayEmoji;

    /** Whether this category is restricted to a specific group of users */
    restricted?: RestrictionType;
}

export type SettingsCategoryName = "general" | "image" | "video" | "chat" | "premium" | "limits" | "plugins" | "character" | "alan"
export type SettingKeyAndCategory = `${SettingsCategoryName}:${SettingsName}`

export const SettingCategories: SettingsCategory[] = [
    {
        name: "General",
        type: "general",
        emoji: { fallback: "🧭" }
    },

    {
        name: "Chat",
        type: "chat",
        emoji: { fallback: "🗨️" }
    },

    {
        name: "Plugins",
        type: "plugins",
        emoji: { fallback: "🚀" }
    },

    {
        name: "Premium",
        type: "premium",
        emoji: { fallback: "✨" },
        restricted: "premium"
    },

    {
        name: "Limits",
        type: "limits",
        emoji: { fallback: "‼️" },
        restricted: "plan"
    },

    {
        name: "Image",
        type: "image",
        emoji: { fallback: "🖼️" }
    },

    {
        name: "Character",
        type: "character",
        emoji: { fallback: "🧙🏽" }
    },

    {
        name: "Alan",
        type: "alan",
        emoji: { display: "<:turing_neon:1100498729414434878>", fallback: "🧑‍💻" }
    }
]

export enum SettingsOptionType {
    /** Simple true-false value */
    Boolean,

    /** Users can enter their own message */
    String,

    /** Users can choose from a list */
    Choices,

    /** Users can type in a number, within a range */
    Number,

    /** Users can choose a Discord role */
    Role
}

interface BaseSettingsOptionData<T = any> {
    /** Key name of the settings option */
    key: SettingsName;

    /** Display name of the settings option */
    name: string;

    /** Category of this settings option */
    category: SettingsCategoryName;

    /** Emoji for the settings option */
    emoji: DisplayEmoji;

    /** Description of the settings option */
    description: string;

    /** Type of the setting */
    type: SettingsOptionType;

    /** Location of the setting */
    location: SettingsLocation;

    /** Explanation of this setting */
    explanation?: SettingsOptionExplanation;

    /** Handler to execute when this setting is changed */
    handler?: (bot: Bot, entry: SettingsDatabaseEntry, value: T) => Awaitable<void>;

    /** Validator to run when the settings get loaded */
    validate?: (value: T, entry: SettingsDatabaseEntry) => boolean | T;

    /** Default value of this settings option */
    default: T;
}

type SettingOptionsData<T = any> = Omit<BaseSettingsOptionData<T>, "type">
type SettingsOptionValueType = any

interface SettingsOptionAddContext<T extends SettingsOptionValueType = any> {
    bot: Bot;
    builder: ActionRowBuilder;
    guild: ChatGuildData | null;
    current: T;
}

interface SettingsOptionExplanation {
    /* Explanation of what this settings option does */
    description: string;
    
    /* URL to an image to attach */
    image?: string;
}

export abstract class SettingsOption<T extends SettingsOptionValueType = any, U extends Partial<BaseSettingsOptionData<T>> = BaseSettingsOptionData<T>> {
    public readonly data: Required<BaseSettingsOptionData<T> & U>;

    constructor(data: BaseSettingsOptionData & U) {
        this.data = data as typeof this.data;
    }

    public abstract add(context: SettingsOptionAddContext<T>): ActionRowBuilder;

    protected applyBase(builder: ActionRowBuilder): ActionRowBuilder {
        builder.addComponents(
            new ButtonBuilder()
                .setLabel(this.data.name)
                .setEmoji(Emoji.display(this.data.emoji, true) as ComponentEmojiResolvable)
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(this.customID(undefined ,"tag"))
                .setDisabled(true)
        );

        if (this.data.explanation) builder.addComponents(
            new ButtonBuilder()
                .setEmoji("❓")
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(this.customID(undefined, "explanation"))
        );
        
        return builder;
    }

    protected customID(value?: T, action?: string): string {
        return `settings:${action ?? "change"}:${this.data.location}:${this.key}${value != undefined ? `:${value}` : ""}`;
    }

    public async handle(bot: Bot, entry: SettingsDatabaseEntry, value: T): Promise<void> {
        if (this.data.handler) await this.data.handler(bot, entry, value);
    }

    public validate(value: T, entry: SettingsDatabaseEntry): boolean | T {
        if (this.data.validate) return this.data.validate(value, entry);
        else return true;
    }

    public get key(): SettingsName {
        return this.data.key;
    }

    public get category(): SettingsCategoryName {
        return this.data.category;
    }
}

type GuildSettingsOptionData = Omit<BaseSettingsOptionData, "location">

export abstract class GuildSettingsOption<T extends any = any> extends SettingsOption<T, GuildSettingsOptionData> {
    constructor(data: GuildSettingsOptionData) {
        super({
            ...data,
            location: SettingsLocation.Guild
        });
    }
}

export class BooleanSettingsOption extends SettingsOption<boolean> {
    constructor(data: SettingOptionsData) {
        super({
            ...data,
            type: SettingsOptionType.Boolean
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<boolean>): ActionRowBuilder {
        return this.applyBase(builder)
            .addComponents([
                new ButtonBuilder()
                    .setCustomId(this.customID(true))
                    .setStyle(current ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setDisabled(current)
                    .setEmoji("👍"),

                new ButtonBuilder()
                    .setCustomId(this.customID(false))
                    .setDisabled(!current)
                    .setStyle(!current ? ButtonStyle.Success : ButtonStyle.Secondary)
                    .setEmoji("👎")
            ]);
    }
}

interface CommonModalSettingOptionData {
    placeholder?: string;
    min: number;
    max: number;
}

type IntegerSettingOptionData = CommonModalSettingOptionData & {
    suffix?: string;
}

export class IntegerSettingsOption extends SettingsOption<number, BaseSettingsOptionData & IntegerSettingOptionData> {
    constructor(data: SettingOptionsData & IntegerSettingOptionData) {
        super({
            ...data,
            type: SettingsOptionType.Number
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<number>): ActionRowBuilder {
        return this.applyBase(builder)
            .addComponents([
                new ButtonBuilder()
                    .setCustomId(this.customID())
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(`${current}${this.data.suffix ? ` ${this.data.suffix}${current > 1 || current === 0 ? "s" : ""}` : ""}`)
                    .setEmoji("📝")
            ]);
    }
}

type StringSettingOptionData = CommonModalSettingOptionData

export class StringSettingsOption extends SettingsOption<string, BaseSettingsOptionData & IntegerSettingOptionData> {
    constructor(data: SettingOptionsData & StringSettingOptionData) {
        super({
            ...data,
            type: SettingsOptionType.String
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<string>): ActionRowBuilder {
        const button = new ButtonBuilder()
            .setCustomId(this.customID())
            .setStyle(ButtonStyle.Secondary)
            .setEmoji("📝");

        if (current.length > 2) button.setLabel(Utils.truncate(current, 80));

        return this.applyBase(builder)
            .addComponents(button);
    }

    public validate(value: string): string | boolean {
        return value.length < this.data.max || value.length > this.data.min;
    }
}

export type ChoiceSettingOptionChoice = Pick<APIApplicationCommandOptionChoice<string>, "name" | "value"> & {
    /** Description for this choice */
    description?: string;

    /** Emoji for this choice */
    emoji?: DisplayEmoji | string;

    /** Whether this option is restricted to a specific group of users */
    restricted?: RestrictionType;
}

interface ChoiceSettingOptionData {
    choices: ChoiceSettingOptionChoice[];
    optional?: boolean;
}

export class ChoiceSettingsOption extends SettingsOption<string | null, BaseSettingsOptionData & ChoiceSettingOptionData> {
    constructor(data: Omit<SettingOptionsData, "default"> & Partial<Pick<SettingOptionsData, "default">> & ChoiceSettingOptionData) {
        super({
            ...data, default: data.default ?? data.choices[0].value, optional: data.optional ?? false,
            type: SettingsOptionType.Choices
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<string | null>): ActionRowBuilder {
        return builder
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(this.customID())
                    .setPlaceholder(`${this.data.name} ${Emoji.display(this.data.emoji)}`)
                    .addOptions([
                        ...this.data.explanation ? [ {
                            label: "What's this setting?", description: "View what this setting does here.",
                            emoji: "❓", value: "explanation"
                        } ] : [],

                        ...this.data.optional ? [ {
                            label: "(none)", description: "Disable this setting.", value: "(none)"
                        } ] : [],

                        ...this.data.choices.map(({ name, value, description, emoji, restricted }) => ({
                            emoji: emoji ? typeof emoji === "string" ? emoji : Emoji.display(emoji, true) as ComponentEmojiResolvable : undefined,
                            description: restricted ? `${description ?? ""} (${restricted}-only)` : description,
                            default: value === current,
                            label: restricted ? `${name} ${restricted === "tester" ? "⚒️" : restricted === "plan" ? "📊" : restricted === "subscription" ? "💸" : "✨"}` : name,
                            value
                        }))
                    ])
            );
    }

    public validate(value: string | null): string | boolean {
        if (this.data.optional && value === null) return true;
        return this.data.choices.find(c => c.value === value) != undefined;
    }
}

type MultipleChoiceSettingsObject = {
    [key: string]: boolean;
}

interface MultipleChoiceSettingOptionData {
    /** Which choices to display */
    choices: ChoiceSettingOptionChoice[];

    /** How many options can be selected, maximum */
    max?: number;
}

export class MultipleChoiceSettingsOption extends SettingsOption<MultipleChoiceSettingsObject, BaseSettingsOptionData & MultipleChoiceSettingOptionData> {
    constructor(data: Omit<SettingOptionsData, "default"> & Partial<Pick<SettingOptionsData, "default">> & MultipleChoiceSettingOptionData) {
        super({
            ...data, default: MultipleChoiceSettingsOption.build(),
            type: SettingsOptionType.Choices
        });
    }

    public static build(arr: MultipleChoiceSettingsObject | string[] = {}): MultipleChoiceSettingsObject {
        const object: Partial<MultipleChoiceSettingsObject> = {};

        for (const choice of !Array.isArray(arr) ? Object.keys(arr) : arr) {
            const enabled: boolean = Array.isArray(arr) ? arr.includes(choice) : arr[choice] ?? false;
            object[choice] = enabled;
        }

        return object as MultipleChoiceSettingsObject;
    }

    public static which(object: MultipleChoiceSettingsObject): string[] {
        return Object.entries(object)
            .filter(([ _, enabled ]) => enabled)
            .map(([ key ]) => key);
    }

    public add({ builder, current }: SettingsOptionAddContext<MultipleChoiceSettingsObject>): ActionRowBuilder {
        /* Which options are currently enabled */
        const enabled: string[] = MultipleChoiceSettingsOption.which(current);

        return builder
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(this.customID())
                    .setPlaceholder(`${this.data.name} ${Emoji.display(this.data.emoji)}${enabled.length > 0 ? ` (${enabled.length} selected)` : ""}`)
                    .addOptions(...this.data.choices.map(({ name, value, description, restricted, emoji }) => ({
                        emoji: enabled.includes(value) ? "<:blurple_check:1105178019020165161>" : emoji ? typeof emoji === "object" ? Emoji.display(emoji, true) : emoji : undefined,
                        description: restricted ? `${description ?? ""} (${restricted}-only)` : description,
                        label: restricted ? `${name} ${restricted === "tester" ? "⚒️" : restricted === "plan" ? "📊" : restricted === "subscription" ? "💸" : "✨"}` : name,
                        value
                    }) as SelectMenuComponentOptionData))
            );
    }

    public validate(value: MultipleChoiceSettingsObject, entry: SettingsDatabaseEntry): boolean | MultipleChoiceSettingsObject {
        /* Which settings are enabled & actually exist */
        let which: string[] = MultipleChoiceSettingsOption.which(value);
        which = which.filter(id => this.data.choices.find(c => c.value === id) != undefined);

        let final: Partial<MultipleChoiceSettingsObject> = {};

        for (const choice of this.data.choices) {
            final[choice.value] = which.includes(choice.value);
        }

        return final as MultipleChoiceSettingsObject;
    }
}

type RoleSettingsOptionData = Omit<BaseSettingsOptionData, "type" | "location" | "default"> & {
    noneTooltip: string;
}

export class RoleSettingsOption extends SettingsOption<Snowflake, RoleSettingsOptionData> {
    constructor(data: RoleSettingsOptionData) {
        super({
            ...data, default: "0",
            type: SettingsOptionType.Role,
            location: SettingsLocation.Guild
        });
    }

    public add({ builder, guild, current }: SettingsOptionAddContext<Snowflake | null>): ActionRowBuilder {
        if (guild === null) throw new Error("No guild data for settings option");

        /* All available roles on the guild */
        const roles = Array.from(guild.guild.roles.cache.values())
            .filter(role => role.hoist && !role.managed)
            .slice(undefined, 20);

        return builder
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(this.customID())
                    .setPlaceholder(`${this.data.name} ${Emoji.display(this.data.emoji)}`)
                    .addOptions([
                        ...this.data.explanation ? [ {
                            label: "What's this setting?", description: "View what this setting does here.",
                            emoji: "❓", value: "explanation"
                        } ] : [],

                        ...roles.map(role => ({
                            label: role.name,
                            value: role.id,
                            default: current === role.id
                        })),
                        
                        { label: "(none)", description: this.data.noneTooltip, value: "0" }
                    ])
            );
    }

    public async getRole(guild: Guild, id: Snowflake): Promise<Role | null> {
        if (id === "0") return null;

        /* Find the corresponding role. */
        let role: Role | null = guild.roles.cache.get(id) ?? await guild.roles.fetch(id).catch(() => null);
        return role;
    }
}

export type GetSettingsTypeParameter<T> = T extends SettingsOption<infer R> ? R : never
export type SettingsName = string

export const SettingOptions: SettingsOption[] = [
    new ChoiceSettingsOption({
        key: "model",
        name: "/imagine model",
        category: "image",
        emoji: { fallback: "🤖" },
        description: "Which image AI model to use",
        location: SettingsLocation.User,

        explanation: {
            description: "This setting changes which AI image generation model will be used for `/imagine` by default, unless modified by the `model` parameter. Some models are only available to **Premium** ✨ users."
        },

        choices: ImageConfigModels.map(({ name, description, id }) => ({
            name, description, value: id
        }))
    }),

    new ChoiceSettingsOption({
        key: "enhancer",
        name: "/imagine prompt enhancer",
        category: "image",
        emoji: { fallback: "✨" },
        description: "Which prompt enhancer to use",
        location: SettingsLocation.User,

        explanation: {
            description: "With this setting, you can change if & how **ChatGPT** should improve or recreate your prompt for the image, in order for the results to look better."
        },

        choices: ImagePromptEnhancers.map(({ name, emoji, id }) => ({
            name, emoji, value: id
        }))
    }),

    new ChoiceSettingsOption({
        key: "style",
        name: "/imagine style",
        category: "image",
        emoji: { fallback: "🤖" },
        description: "Which style to use",
        location: SettingsLocation.User,
        optional: true, default: null,
        
        choices: ImageStyles.map(({ name, emoji, id }) => ({
            name, emoji, value: id
        }))
    }),

    new IntegerSettingsOption({
        key: "count",
        name: "/imagine image count",
        category: "image",
        emoji: { fallback: "🔢" },
        description: "How many images to generate",
        max: 4, min: 1, suffix: "image",
        default: 2,
        location: SettingsLocation.User
    }),

    new ChoiceSettingsOption({
        key: "language",
        name: "Language",
        category: "general",
        emoji: { fallback: "🌐" },
        description: "Primary language to use for the bot",
        location: SettingsLocation.User,

        explanation: {
            description: "This setting will force ChatGPT to speak in a different language, and also change the output language of the `Translate` right-click action. In the future, the UI will also be fully localized."
        },

        choices: UserLanguages.map(locale => ({
            name: locale.name, emoji: { fallback: locale.emoji },
            value: locale.id
        }))
    }),

    new BooleanSettingsOption({
        key: "partialMessages",
        name: "Partial messages",
        category: "chat",
        emoji: { fallback: "⏳" },
        description: "Whether chat messages by the bot should be shown while they're being generated",
        location: SettingsLocation.User,
        default: true,

        explanation: {
            description: "This setting changes whether the bot should send partial messages by ChatGPT while they're being generated, just like on the website. This does not affect generation speed or maximum generation length in any way."
        }
    }),

    new ChoiceSettingsOption({
        key: "model",
        name: "Model",
        category: "chat",
        emoji: { fallback: "🤖" },
        description: "Which language model to use for chatting",
        location: SettingsLocation.User,

        choices: ChatSettingsModels.map(model => ({
            name: model.options.name,
            description: model.options.description,
            restricted: model.options.restricted ?? undefined,
            emoji: model.options.emoji,
            value: model.id
        })),

        handler: async (bot, user) => {
            const conversation: Conversation | null = bot.conversation.get(user);
            if (conversation === null) return;

            await conversation.reset(user as DatabaseUser, false);
        }
    }),

    new ChoiceSettingsOption({
        key: "tone",
        name: "Tone",
        category: "chat",
        emoji: { fallback: "🗣️" },
        description: "Which tone to use for chatting",
        location: SettingsLocation.User,

        choices: ChatSettingsTones.map(tone => ({
            name: tone.options.name,
            description: tone.options.description,
            premium: tone.options.restricted,
            emoji: tone.options.emoji,
            value: tone.id
        })),

        handler: async (bot, user) => {
            const conversation: Conversation | null = bot.conversation.get(user);
            if (conversation === null) return;

            await conversation.reset(user as DatabaseUser, false);
        }
    }),

    new ChoiceSettingsOption({
        key: "loadingIndicator",
        name: "Loading indicator",
        category: "general",
        emoji: { display: LoadingIndicatorManager.toString(LoadingIndicators[0]), fallback: "🔃" },
        description: "Which loading indicator to use throughout the bot, and for partial messages",
        location: SettingsLocation.User,

        choices: LoadingIndicators.map(indicator => ({
            display: indicator.name,
            emoji: LoadingIndicatorManager.toString(indicator),
            value: indicator.emoji.id,
            name: indicator.name,
            premium: false
        }))
    }),

    new ChoiceSettingsOption({
        key: "searchEngine",
        name: "Search engine",
        category: "alan",
        emoji: { fallback: "🔎" },
        description: "Which search engine to use",
        choices: alanOptions(TuringAlanSearchEngines),
        location: SettingsLocation.User
    }),

    new ChoiceSettingsOption({
        key: "imageGenerator",
        name: "Image generator",
        category: "alan",
        emoji: { fallback: "🖨️" },
        description: "Which image generator to use",
        choices: alanOptions(TuringAlanImageGenerators),
        location: SettingsLocation.User
    }),

    new ChoiceSettingsOption({
        key: "imageModifier",
        name: "Image modifier",
        category: "alan",
        emoji: { fallback: "🖌️" },
        description: "Which image modifier to use",
        choices: alanOptions(TuringAlanImageModifiers),
        location: SettingsLocation.User
    }),

    new RoleSettingsOption({
        key: "role",
        name: "Premium-restricted role",
        category: "premium",
        emoji: { fallback: "✨" },
        description: "Which role is only allowed to use Premium features of the bot",
        noneTooltip: "Don't lock Premium features to a specific role",

        explanation: {
            description: "Choosing a role for this setting will lock all **Premium** features (*no cool-down, configurable token limit*, *etc.*) for a specific role on this server. Users who don't have this role will simply use their own subscription, if they have one."
        }
    }),

    new IntegerSettingsOption({
        key: "cooldown",
        name: "Cool-down for all users",
        category: "limits",
        emoji: { fallback: "⏰" },
        description: "Cool-down overwrite for users on the server",
        location: SettingsLocation.Guild,
        default: Math.floor(ConversationDefaultCooldown.time / 1000), min: 5, max: 300,
        suffix: "second",

        explanation: {
            description: "This setting will change the cool-down for all users, regardless of whether they have the **Premium**-restricted role configured above or not. Users who have their own Premium subscription will not be affected by this setting."
        }
    }),

    new IntegerSettingsOption({
        key: "contextTokens",
        name: "Context/history tokens",
        category: "limits",
        emoji: { fallback: "🔢" },
        description: "How many tokens to use up maximum for the initial prompt & chat history",
        location: SettingsLocation.Both,
        default: 650, min: 150, max: 8192,
        suffix: "token",

        explanation: {
            description: "To have conversations with the AI, we send as much chat history (the previous interactions with the bot) as possible, to keep context about the current topic. This also includes a small description to the AI model about itself, and possible descriptions about attached images. (*e.g. `You are ChatGPT, a large language model ...`*)\nThis indirectly controls how many messages will be in history, but you can also limit the amount of messages in the history using the **Maximum messages in history** setting. The default for this setting is enough for around **10-12** short messages, **5-6** medium-long messages and **2-4** long messages.\nYou can use the [**OpenAI tokenizer**](https://platform.openai.com/tokenizer) site to roughly count how many tokens a message takes up. **Remember: the more tokens and chat history you use, the more expensive it gets per message**."
        }
    }),

    new IntegerSettingsOption({
        key: "generationTokens",
        name: "Generation tokens",
        category: "limits",
        emoji: { fallback: "🔢" },
        description: "How many tokens the AI can generate at maximum",
        location: SettingsLocation.Both,
        default: 500, min: 30, max: 8192,
        suffix: "token",

        explanation: {
            description: "With this setting, you can control how long generated by the AI *can* be. This will not make the AI more verbose (or concise if you lower it), it only limits the amount of tokens a generated message can use up at maximum. You can use the [**OpenAI tokenizer**](https://platform.openai.com/tokenizer) site to roughly count how many tokens a message takes up. **Remember: the more tokens you use, the more expensive it gets per message**."
        }
    }),

    new ChoiceSettingsOption({
        key: "typePriority",
        name: "Which Premium type to prioritize",
        category: "premium",
        emoji: { fallback: "✨" },
        description: "Which Premium type to prioritize",
        location: SettingsLocation.Both,

        explanation: {
            description: "If you have both the **fixed, subscription-based** and **pay-as-you-go** Premium, you can configure which plan will be used first here. If you choose **Fixed 💸** and you have the fixed **Premium** subscription, you will not use any of your charged credits and have higher cool-down and length limits. If you choose **Pay-as-you-go 📊** and you have enough credit, you will use that plan (as long as you still have credit) and can enjoy **no cool-down** and **configurable** length limits."
        },

        choices: [
            {
                name: "Pay-as-you-go", emoji: "📊", value: "plan",
                description: "Use the credit-based pay-as-you-go plan first"
            },

            {
                name: "Subscription", emoji: "💸", value: "subscription",
                description: "Use the fixed subscription first"
            }
        ]
    }),

    new ChoiceSettingsOption({
        key: "locationPriority",
        name: "Whether to prioritize your own or the server's Premium",
        category: "premium",
        emoji: { fallback: "✨" },
        description: "Whether to prioritize your own or the server's Premium",
        location: SettingsLocation.User,

        explanation: {
            description: "This setting changes if **your own** or **the server's** Premium will be used first. If you always want to use your own subscription only, toggle this to **My own Premium**. Otherwise, if you want to use the server's subscription if it has one, change this to **The server's Premium**."
        },

        choices: [
            {
                name: "The server's Premium", emoji: "☎️", value: "guild",
                description: "Use the server's Premium before using your own"
            },

            {
                name: "My own Premium", emoji: "👤", value: "user",
                description: "Always use your own Premium, not regarding whether the server has Premium or not"
            }
        ]
    }),

    new ChoiceSettingsOption({
        key: "toolbar",
        name: "How to show Pay-as-you-go credit in toolbar",
        category: "premium",
        emoji: { fallback: "🧰" },
        description: "Whether remaining & total credit should be shown in the tool-bar",
        location: SettingsLocation.User,
        default: "full",

        choices: [
            {
                name: "Detailed", value: "detailed",
                description: "Show the full used, total credit and credit used for the message in the toolbar"
            },

            {
                name: "Used & total", value: "full",
                description: "Show the full used & total credit in the toolbar"
            },

            {
                name: "Used", value: "used",
                description: "Just show the used credit in the toolbar"
            },

            {
                name: "Percentage", value: "percentage",
                description: "Show the used credit in a percentage in the toolbar"
            },

            {
                name: "Don't show", value: "hide",
                description: "Don't show your credit at all in the toolbar"
            }
        ],

        explanation: {
            description: "This controls whether (and how, if at all) your used & total credit will be shown below ChatGPT's generated messages, for everyone to see. This won't show up on servers with the **pay-as-you-go** plan."
        }
    }),

    new ChoiceSettingsOption({
        key: "mode",
        name: "How to display the custom character in chat",
        category: "character",
        emoji: { fallback: "🏷️" },
        description: "How to display the custom character in chat",
        location: SettingsLocation.Guild,
        default: "off",

        choices: [
            {
                name: "Use a custom character", emoji: "✅",
                description: "Configure a custom name & avatar for the bot",
                value: "on"
            },

            {
                name: "Don't use a custom character", emoji: "❌",
                value: "off"
            }
        ],

        explanation: {
            description: "Using this setting, you can control if and how the configured custom character displays in chat.\n**Make sure to give the bot the `Manage webhooks` permission, in order to use this feature without any issues.**"
        }
    }),

    new StringSettingsOption({
        key: "name",
        name: "Custom character name",
        category: "character",
        emoji: { fallback: "🏷️" },
        description: "Name of the character",
        location: SettingsLocation.Guild,
        default: "ChatGPT", min: 2, max: 32,
        placeholder: "Ol' mighty ChatGPT",

        explanation: {
            description: "This setting changes the name of the custom character, and how it is displayed in chat."
        }
    }),

    new StringSettingsOption({
        key: "avatar",
        name: "Custom character avatar",
        category: "character",
        emoji: { fallback: "👤" },
        description: "Character avatar URL",
        location: SettingsLocation.Guild,
        default: "https://app.turing.sh/icons/neon.png", min: 0, max: 1024,
        placeholder: "https://app.turing.sh/icons/neon.png",

        explanation: {
            description: "This setting changes the avatar of the custom character, set it to any valid image URL to see it in the chat."
        }
    }),

    new BooleanSettingsOption({
        key: "debug",
        name: "Whether raw tool results should be shown in an embed",
        category: "plugins",
        emoji: { fallback: "🐛" },
        description: "Which ChatGPT/GPT-4 plugins to enable",
        location: SettingsLocation.User,
        default: false
    }),

    new MultipleChoiceSettingsOption({
        key: "list",
        name: "Which plugins to use",
        category: "plugins",
        emoji: { fallback: "🛠️" },
        description: "Which ChatGPT/GPT-4 plugins to enable",
        location: SettingsLocation.User,
        max: 3,

        choices: ChatSettingsPlugins.map(plugin => ({
            name: plugin.options.name,
            emoji: plugin.options.emoji !== null ? plugin.options.emoji as DisplayEmoji : undefined,
            description: plugin.options.description,
            value: plugin.id,
        }))
    }),

    new MultipleChoiceSettingsOption({
        key: "excludedModels",
        name: "Excluded models",
        category: "premium",
        emoji: { fallback: "⛔" },
        description: "Which models to not include in the Pay-as-you-go charges",
        location: SettingsLocation.Both,

        explanation: {
            description: "This setting disables **Pay-as-you-go** charges for all of the selected models. You will be subject to the regular cool-downs & limits for the specified models, without getting charged for your usage.\n\n🚧 **This feature is not available yet!** 🚧"
        },

        choices: ChatSettingsModels.filter(model => model.options.restricted === null).map(model => ({
            name: model.options.name,
            description: model.options.description,
            restricted: model.options.restricted ?? undefined,
            emoji: model.options.emoji,
            value: model.id
        }))
    })
]

interface SettingsPageBuilderOptions {
    /* Database instance */
    db: SettingsDatabaseEntry;

    /* Category of the current page */
    category: SettingsCategory;

    /* Interaction, which triggered the page builder */
    interaction: ChatInputCommandInteraction | StringSelectMenuInteraction | ButtonInteraction;
}

export class BaseSettingsManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {
    protected location(entry: SettingsDatabaseEntry): SettingsLocation {
        if ((entry as any).interactions != undefined) return SettingsLocation.User;
        return SettingsLocation.Guild;
    }

    public options(location: SettingsLocation, category?: SettingsCategory): SettingsOption[] {
        return SettingOptions
            .filter(s => category ? s.category === category.type : true)
            .filter(s => s.data.location === SettingsLocation.Both || location === SettingsLocation.Both || s.data.location === location);
    }

    public categories(location: SettingsLocation): SettingsCategory[] {
        return SettingCategories
            .filter(category =>
                this.options(location, category).filter(
                    o => o.data.location === SettingsLocation.Both || location === SettingsLocation.Both || o.data.location === location
                ).length > 0
            );
    }

    public template(location: SettingsLocation): DatabaseSettings {
        const settings: Partial<DatabaseSettings> = {};

        for (const option of this.options(location)) {
            settings[this.settingsString(option)] = option.data.default;
        }

        return settings as DatabaseSettings;
    }

    public load(entry: SettingsDatabaseEntry): DatabaseSettings {
        const settings: Partial<DatabaseSettings> = {};

        for (const option of this.options(this.location(entry))) {
            /* Current, unmodified value */
            let value = entry.settings ? this.get(entry, this.settingsString(option)) : undefined ?? this.settingsDefault(entry, option);

            /* Try to validate the current setting value. */
            const validation = option.validate(value, entry);

            /* The setting is invalid, and should be reset to the defaults. */
            if (validation === false) value = this.settingsDefault(entry, option);
            else if (validation !== true) value = validation;

            settings[this.settingsString(option)] = value;
        }

        return settings as DatabaseSettings;
    }
    
    public settingsDefault(entry: SettingsDatabaseEntry, option: SettingsOption): any {
        return this.template(this.location(entry))[this.settingsString(option)];
    }

    public settingsString(option: SettingsOption | SettingKeyAndCategory): SettingKeyAndCategory {
        return typeof option === "object"
            ? `${option.category}:${option.key}`
            : option;
    }

    public settingsCategoryAndKey(option: SettingsOption | SettingKeyAndCategory): { category: SettingsCategory, key: string } | null {
        const categoryName: string = typeof option === "string" ? option.split(":").shift()! : option.category;
        const key: string = typeof option === "string" ? option.split(":").pop()! : option.key;

        const category: SettingsCategory | null = SettingCategories.find(c => c.type === categoryName) ?? null;
        if (category === null) return null;

        return {
            category, key
        };
    }

    public settingsOption<T extends SettingsOption = SettingsOption>(key: SettingKeyAndCategory | ReturnType<InstanceType<typeof ClusterSettingsManager>["settingsCategoryAndKey"]>): T | null {
        /* Extract the key & category from the specified option. */
        const data = typeof key === "string" ? this.settingsCategoryAndKey(key) : key;
        if (data === null) return null;

        return SettingOptions.find(s =>
            s.key === data.key && s.category === data.category.type
        ) as T ?? null;
    }

    public get<T extends any>(entry: SettingsDatabaseEntry, key: SettingKeyAndCategory): T {
        let value: T = entry.settings[key] as T;
        if (value === undefined) value = this.template(this.location(entry))[key];

        return value;
    }
}

export class AppSettingsManager extends BaseSettingsManager<AppDatabaseManager> {

}

export class ClusterSettingsManager extends BaseSettingsManager<ClusterDatabaseManager> {
    public async apply<T extends SettingsDatabaseEntry>(entry: T, changes: Partial<Record<SettingKeyAndCategory, any>>): Promise<T> {
        if (this.db.bot.dev) this.db.bot.logger.debug("Apply settings ->", chalk.bold(entry.id), "->", `${chalk.bold(Object.values(changes).length)} changes`);

        const final: DatabaseSettings = {
            ...entry.settings,
            ...changes
        };

        for(const [ key ] of Object.entries(changes)) {
            const option = this.settingsOption(key as SettingKeyAndCategory)!;
            await option.handle(this.db.bot, entry, entry.settings[key as SettingKeyAndCategory]);
        }

        /* Apply all the changes and return the updated database user instance. */
        return await this.db.users[this.location(entry) === SettingsLocation.Guild ? "updateGuild" : "updateUser"](entry as any, {
            settings: final
        }) as T;
    }

	public async guildData(interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction): Promise<ChatGuildData | null> {
		if (!(interaction.channel instanceof TextChannel) || !interaction.guild || !(interaction.member instanceof GuildMember)) return null;

		return {
			guild: interaction.guild,
			member: interaction.member,
			channel: interaction.channel,
			owner: await interaction.guild.fetchOwner()
		};
	}

    public buildPageSwitcher({ db, category: current }: SettingsPageBuilderOptions): ActionRowBuilder<ButtonBuilder> {
        /* Current category index */
        const currentIndex: number = this.categories(this.location(db)).findIndex(c => c.type === current.type);

        /* Page switcher row builder */
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
            new ButtonBuilder()
                .setEmoji("◀️").setStyle(ButtonStyle.Secondary)
                .setCustomId(`settings:page:${this.location(db)}:-1`)
                .setDisabled(currentIndex - 1 < 0),

            new ButtonBuilder()
                .setLabel(current.name)
                .setEmoji(Emoji.display(current.emoji, true) as ComponentEmojiResolvable)
                .setCustomId(`settings:current:${this.location(db)}:${current.type}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),

            new ButtonBuilder()
                .setEmoji("▶️").setStyle(ButtonStyle.Secondary)
                .setCustomId(`settings:page:${this.location(db)}:1`)
                .setDisabled(currentIndex + 1 > this.categories(this.location(db)).length - 1)
        );

        return row;
    }

    public async buildPage({ db, category, interaction }: SettingsPageBuilderOptions): Promise<Response> {
        /* Page switcher row */
        const switcher = this.buildPageSwitcher({ db, category, interaction });

        /* Options for this category */
        const options: SettingsOption[] = this.options(this.location(db), category);

        /* Final response */
        const response: Response = new Response()
            .setEphemeral(true);

        for (const option of options) {
            /* Current value of this option */
            const key = this.settingsString(option);
            const current = this.get(db, key);

            /* Create the button row. */
            const row: ActionRowBuilder = option.add({
                bot: this.db.bot, builder: new ActionRowBuilder(),
                current, guild: await this.guildData(interaction)
            });

            response.addComponent(ActionRowBuilder, row);
        }

        return response
            .addComponent(ActionRowBuilder<ButtonBuilder>, switcher);
    }

    public async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction, db: DatabaseInfo, data: string[]): InteractionHandlerResponse {
        /* Type of settings action */
        const type: "page" | "current" | "change" | "menu" | "explanation" = data.shift()! as any;
        data.shift();

        /* Components on the original message */
        const components = (interaction.message.components[interaction.message.components.length - 1] as ActionRow<ButtonComponent>).components ;

        const [ _, __, originRaw, categoryType ] = components.length > 2 && components[1].disabled
            ? components[1].customId!.split(":")
            : interaction.customId.split(":");

        const origin: SettingsLocation = originRaw as any;

        let entry: SettingsDatabaseEntry = origin === SettingsLocation.Both
            ? db[origin as "guild" | "user"]!
            : origin === SettingsLocation.Guild ? db.guild! : db.user;
        
        /* Subscription type of the user & guild */
        const subscriptionType = await this.db.users.type(db);

        if (type === "menu") {
            /* Category name & the actual category */
            const name: string = data.shift()!;

            const category: SettingsCategory | null = this.categories(origin).find(c => c.type === name) ?? null;
            if (category === null) return;

            return await this.buildPage({
                category, interaction, db: entry
            });
        }

        /* Current settings category & index */
        const category: SettingsCategory | null = this.categories(origin).find(c => c.type === categoryType) ?? null;
        const categoryIndex: number = this.categories(origin).findIndex(c => c.type === categoryType);

        if (category === null) return;

        /* Change the page */
        if (type === "page") {
            /* How to switch the pages, either -1 or (+)1 */
            const delta: number = parseInt(data.shift()!);

            /* New category to switch to */
            const newCategory: SettingsCategory | null = this.categories(origin).at(categoryIndex + delta) ?? null;
            if (newCategory === null) return;
            
            await interaction.update((await this.buildPage({
                category: newCategory, interaction, db: entry
            })).get() as InteractionUpdateOptions);

        /* Update a setting */
        } else if (type === "change") {
            /* Key of the setting */
            const rawKey: string = data.shift()!;
            const key: SettingKeyAndCategory = `${category.type}:${rawKey}`;

            /* The settings option itself */
            const option: SettingsOption | null = this.options(origin, category)
                .find(o => o.key === rawKey && o.category === category.type) ?? null;

            if (option === null) return;

            /* New value of this setting, if applicable */
            const newValue: string | null = data.shift() ?? null;
            const previous: any = this.get(entry, key);

            /* Final changes to the settings */
            let changes: Partial<Record<SettingKeyAndCategory, any>> = {};

            if (interaction instanceof StringSelectMenuInteraction && interaction.values[0] === "explanation" && option.data.explanation) {
                const response: Response = new Response()
                    .addEmbed(builder => builder
                        .setTitle(`${option.data.name} ${Emoji.display(option.data.emoji, true)}`)
                        .setDescription(option.data.explanation.description)
                        .setImage(option.data.explanation.image ?? null)
                        .setColor(this.db.bot.branding.color)
                    )
                    .setEphemeral(true);

                return void await interaction.reply(response.get() as InteractionReplyOptions);
            }

            if (option instanceof BooleanSettingsOption) {
                changes[key] = newValue === "true";

            } else if (option instanceof RoleSettingsOption && interaction instanceof StringSelectMenuInteraction) {
                const roleID: Snowflake = interaction.values[0];
                changes[key] = roleID;

            } else if ((option instanceof ChoiceSettingsOption || option instanceof MultipleChoiceSettingsOption) && interaction instanceof StringSelectMenuInteraction) {
                const newValueName: string = interaction.values[0];

                if (newValueName === "(none)") {
                    changes[key] = null;

                } else {
                    const choice: ChoiceSettingOptionChoice | null = option.data.choices.find(c => c.value === newValueName) ?? null;
                    if (choice === null) return;
    
                    if (choice.restricted === "tester" && !this.db.role.tester(db.user)) {
                        return void await new Response()
                            .addEmbed(builder => builder
                                .setDescription(`The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **testers**. ⚒️`)
                                .setColor("Orange")
                            )
                            .setEphemeral(true)
                        .send(interaction);
                    }
    
                    if (choice.restricted === "premium" && !subscriptionType.premium) {
                        return void await new Response()
                            .addEmbed(builder => builder
                                .setDescription(`✨ The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **Premium** users.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
                                .setColor("Orange")
                            )
                            .setEphemeral(true)
                        .send(interaction);
                    }
    
                    if (choice.restricted === "subscription" && subscriptionType.type !== "subscription") {
                        return void await new Response()
                            .addEmbed(builder => builder
                                .setDescription(`✨ The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **fixed Premium 💸** users.\n**Premium** *also includes further benefits, view \`/premium\` for differences between them & more*. ✨`)
                                .setColor("Orange")
                            )
                            .setEphemeral(true)
                        .send(interaction);
                    }
    
                    if (choice.restricted === "plan" && subscriptionType.type !== "plan") {
                        return void await new Response()
                            .addEmbed(builder => builder
                                .setDescription(`✨ The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **pay-as-you-go Premium 📊** users.\n**Premium** *also includes further benefits, view \`/premium\` for differences between them & more*. ✨`)
                                .setColor("Orange")
                            )
                            .setEphemeral(true)
                        .send(interaction);
                    }
    
                    if (option instanceof ChoiceSettingsOption) {
                        changes[key] = newValueName;
    
                    } else if (option instanceof MultipleChoiceSettingsOption) {
                        const updated: Partial<MultipleChoiceSettingsObject> = {};
                        
                        option.data.choices.forEach(c => {
                            updated[c.value] = (newValueName === c.value ? !previous[newValueName] : previous[c.value]) ?? false;
                        });
    
                        if (option.data.max && Object.values(updated).filter(Boolean).length > option.data.max) {
                            return void await new Response()
                                .addEmbed(builder => builder
                                    .setDescription(`The option **${option.data.name}**${option.data.emoji ? ` ${typeof option.data.emoji === "object" ? Emoji.display(option.data.emoji, true) : option.data.emoji}` : ""} is limited to **${option.data.max}** selected choices at a time.`)
                                    .setColor("Red")
                                )
                                .setEphemeral(true)
                            .send(interaction);
                        }
                        
                        changes[key] = updated;
                    }
                }

            } else if (option instanceof IntegerSettingsOption || option instanceof StringSettingsOption) {
                const customID: string = randomUUID();

                const modal: ModalBuilder = new ModalBuilder()
                    .setCustomId(customID)
                    .setTitle(`Change the setting 📝`)
                    .addComponents(
                        new ActionRowBuilder<TextInputBuilder>()
                            .addComponents(new TextInputBuilder()
                                .setCustomId("value")
                                .setRequired(option.data.min > 0)
                                .setValue(previous.toString())
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder(option.data.placeholder ? option.data.placeholder : "Enter a new value...")
                                .setLabel(`${option.data.name} (${option.data.type === SettingsOptionType.String ? `${option.data.min}-${option.data.max} characters` : `${option.data.min}-${option.data.max}`}${option.data.suffix ? ` ${option.data.suffix}s` : ""})`)
                                .setMinLength(option.data.type === SettingsOptionType.String ? option.data.min : 1)
                                .setMaxLength(option.data.type === SettingsOptionType.String ? option.data.max : 5)
                            )
                    );

                /* Show the model to the user, then waiting for their input. */
                await interaction.showModal(modal);

                /* Wait for the user to submit the modal. */
                await new Promise<void>(resolve => {
                    const clean = () => {
                        this.db.bot.client.off("interactionCreate", listener);
                        clearTimeout(timer);
                        resolve();
                    }

                    const timer = setTimeout(() => {
                        clean();
                    }, 60 * 1000);

                    const listener = async (interaction: Interaction) => {
                        if (!interaction.isModalSubmit() || interaction.user.id !== db.user.id || interaction.customId !== customID) return;

                        /* Raw, new value */
                        const raw: string = interaction.fields.getTextInputValue("value");

                        /* Parse the raw value, if needed. */
                        const change: string | number = option.data.type === SettingsOptionType.Number
                            ? parseInt(raw) : raw; 

                        if (option.data.type === SettingsOptionType.Number && isNaN(change as number)) {
                            clean();

                            return void await new ErrorResponse({
                                interaction, message: `You must specify a valid number between **${option.data.min}** and **${option.data.max}**${option.data.suffix ? ` ${option.data.suffix}s` : ""}`
                            }).send(interaction);
                        }

                        if (option.data.type === SettingsOptionType.Number && ((change as number) > option.data.max || (change as number) < option.data.min)) {
                            clean();

                            return void await new ErrorResponse({
                                interaction, message: `You must specify a valid number between **${option.data.min}** and **${option.data.max}**${option.data.suffix ? ` ${option.data.suffix}s` : ""}`
                            }).send(interaction);
                        }

                        await interaction.deferUpdate().catch(() => {});

                        changes[key] = change;
                        clean();
                    };

                    this.db.bot.client.on("interactionCreate", listener);
                });
            }

            /* Apply the final changes, also refreshing the settings page. */
            if (Object.keys(changes).length > 0) {
                entry = await this.apply<any>(entry, changes);

                await interaction[interaction.deferred || interaction.replied ? "editReply" : "update"]((await this.buildPage({
                    category, interaction, db: entry
                })).get() as InteractionUpdateOptions);
            } else {
                if (!interaction.replied) await interaction.deferUpdate();
            }

        /* View an explanation of this setting */
        } else if (type === "explanation") {
            /* Key of the setting */
            const rawKey: string = data.shift()!;

            /* The settings option itself */
            const option: SettingsOption | null = this.options(origin, category)
                .find(o => o.key === rawKey && o.category === category.type) ?? null;

            if (option === null || !option.data.explanation) return;

            const response: Response = new Response()
                .addEmbed(builder => builder
                    .setTitle(`${option.data.name} ${Emoji.display(option.data.emoji, true)}`)
                    .setDescription(option.data.explanation.description)
                    .setImage(option.data.explanation.image ?? null)
                    .setColor(this.db.bot.branding.color)
                )
                .setEphemeral(true);

            return response;
            
        } else if (type === "current") {
            await interaction.deferUpdate();
        }
    }
}