import { APIApplicationCommandOptionChoice, ActionRow, ActionRowBuilder, Awaitable, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ComponentEmojiResolvable, GuildMember, Interaction, InteractionReplyOptions, InteractionUpdateOptions, ModalBuilder, SelectMenuComponentOptionData, StringSelectMenuBuilder, StringSelectMenuInteraction, TextChannel, TextInputBuilder, TextInputStyle } from "discord.js";
import { ChatInputCommandInteraction } from "discord.js";
import chalk from "chalk";

import { TuringAlanImageGenerators, TuringAlanImageModifiers, TuringAlanPlugins, TuringAlanSearchEngines, TuringVideoModels, alanOptions } from "../../turing/api.js";
import { CONVERSATION_DEFAULT_COOLDOWN, Conversation } from "../../conversation/conversation.js";
import { DatabaseInfo, DatabaseUser, DatabaseSettings, DatabaseGuild } from "./user.js";
import { LoadingIndicatorManager, LoadingIndicators } from "../types/indicator.js";
import { GENERATION_SIZES, getAspectRatio } from "../../commands/imagine.js";
import { STABLE_HORDE_AVAILABLE_MODELS } from "../../image/types/model.js";
import { ChatSettingsModels } from "../../conversation/settings/model.js";
import { ChatSettingsTones } from "../../conversation/settings/tone.js";
import { ErrorResponse } from "../../command/response/error.js";
import { ChatGuildData } from "../../chat/types/options.js";
import { RestrictionType } from "../types/restriction.js";
import { DisplayEmoji, Emoji } from "../../util/emoji.js";
import { ClientDatabaseManager } from "../cluster.js";
import { Response } from "../../command/response.js";
import { Languages } from "../types/locale.js";
import { Bot } from "../../bot/bot.js";
import { Snowflake } from "discord.js";
import { Role } from "discord.js";
import { Guild } from "discord.js";

export enum SettingsLocation {
    Guild = "guild",
    User = "user",
    Both = "both"
}

export type SettingsDatabaseEntry = DatabaseUser | DatabaseGuild

export interface SettingsCategory {
    /* Type of the category */
    type: SettingsCategoryName;

    /* Display name of the category */
    name: string;

    /* Emoji for this category */
    emoji: DisplayEmoji;
}

export type SettingsCategoryName = "general" | "image" | "video" | "chat" | "premium" | "limits" | "alan"
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
        name: "Premium",
        type: "premium",
        emoji: { fallback: "✨" }
    },

    {
        name: "Premium limits",
        type: "limits",
        emoji: { fallback: "‼️" }
    },

    {
        name: "Image",
        type: "image",
        emoji: { fallback: "🖼️" }
    },

    {
        name: "Video",
        type: "video",
        emoji: { fallback: "📷" }
    },

    {
        name: "Alan",
        type: "alan",
        emoji: { display: "<:turing_neon:1100498729414434878>", fallback: "🧑‍💻" }
    }
]

export enum SettingsOptionType {
    /* Simple true-false value */
    Boolean,

    /* Users can enter their own message */
    String,

    /* Users can choose from a list */
    Choices,

    /* Users can type in a number, within a range */
    Number,

    /* Users can choose a Discord role */
    Role
}

interface BaseSettingsOptionData<T = any> {
    /* Key name of the settings option */
    key: SettingsName;

    /* Display name of the settings option */
    name: string;

    /* Category of this settings option */
    category: SettingsCategoryName;

    /* Emoji for the settings option */
    emoji: DisplayEmoji;

    /* Description of the settings option */
    description: string;

    /* Type of the setting */
    type: SettingsOptionType;

    /* Location of the setting */
    location: SettingsLocation;

    /* Explanation of this setting */
    explanation?: SettingsOptionExplanation;

    /* Handler to execute when this setting is changed */
    handler?: (bot: Bot, entry: SettingsDatabaseEntry, value: T) => Awaitable<void>;

    /* Default value of this settings option */
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
    public readonly data: Required<BaseSettingsOptionData & U>;

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

    protected customID(value?: string | number | boolean, action?: string): string {
        return `settings:${action ?? "change"}:${this.data.location}:${this.key}${value != undefined ? `:${value}` : ""}`;
    }

    public async handle(bot: Bot, entry: SettingsDatabaseEntry, value: T): Promise<void> {
        if (this.data.handler) await this.data.handler(bot, entry, value);
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

interface IntegerSettingOptionData {
    min: number;
    max: number;
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

interface StringSettingOptionData {
    min: number;
    max: number;
}

export class StringSettingsOption extends SettingsOption<string, BaseSettingsOptionData & IntegerSettingOptionData> {
    constructor(data: SettingOptionsData & StringSettingOptionData) {
        super({
            ...data,
            type: SettingsOptionType.String
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<string>): ActionRowBuilder {
        return this.applyBase(builder)
            .addComponents([
                new ButtonBuilder()
                    .setCustomId(this.customID())
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(current)
                    .setEmoji("📝")
            ]);
    }
}

export type ChoiceSettingOptionChoice = Pick<APIApplicationCommandOptionChoice<string>, "name" | "value"> & {
    /* Description for this choice */
    description?: string;

    /* Emoji for this choice */
    emoji?: DisplayEmoji | string;

    /* Whether this option is restricted to a specific group of users */
    restricted?: RestrictionType | null;
}

interface ChoiceSettingOptionData {
    choices: ChoiceSettingOptionChoice[];
}

export class ChoiceSettingsOption extends SettingsOption<string, BaseSettingsOptionData & ChoiceSettingOptionData> {
    constructor(data: Omit<SettingOptionsData, "default"> & Partial<Pick<SettingOptionsData, "default">> & ChoiceSettingOptionData) {
        super({
            ...data, default: data.default ?? data.choices[0].value,
            type: SettingsOptionType.Choices
        });
    }

    public add({ builder, current }: SettingsOptionAddContext<string>): ActionRowBuilder {
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

                        ...this.data.choices.map(({ name, value, description, emoji, restricted }) => ({
                            emoji: emoji ? typeof emoji === "string" ? emoji : Emoji.display(emoji, true) as ComponentEmojiResolvable : undefined,
                            description: restricted ? `${description ?? ""} (${restricted === RestrictionType.PremiumOnly ? "premium-only ✨" : "tester-only ⚒️"})` : description,
                            default: value === current,
                            label: name, value
                        }))
                    ])
            );
    }
}

type MultipleChoiceSettingsObject = {
    [key: string]: boolean;
}

interface MultipleChoiceSettingOptionData {
    choices: ChoiceSettingOptionChoice[];
}

export class MultipleChoiceSettingsOption extends SettingsOption<MultipleChoiceSettingsObject, BaseSettingsOptionData & MultipleChoiceSettingOptionData> {
    constructor(data: Omit<SettingOptionsData, "default"> & Partial<Pick<SettingOptionsData, "default">> & MultipleChoiceSettingOptionData) {
        super({
            ...data, default: MultipleChoiceSettingsOption.build(),
            type: SettingsOptionType.Choices
        });
    }

    public static build(enabled: MultipleChoiceSettingsObject = {}): MultipleChoiceSettingsObject {
        const object: Partial<MultipleChoiceSettingsObject> = {};

        for (const choice of Object.keys(enabled)) {
            object[choice] = enabled[choice] ?? false;
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
                    .addOptions(...this.data.choices.map(({ name, value, description, restricted }) => ({
                        emoji: enabled.includes(value) ? "<:blurple_check:1105178019020165161>" : undefined,
                        description: restricted ? `${description ?? ""} (${restricted === RestrictionType.PremiumOnly ? "premium-only ✨" : "tester-only ⚒️"})` : description,
                        label: name, value
                    }) as SelectMenuComponentOptionData))
            );
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
            .slice(undefined, 25);

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

    new IntegerSettingsOption({
        key: "steps",
        name: "/imagine generation steps",
        category: "image",
        emoji: { fallback: "🪜" },
        description: "How many steps to generate with",
        max: 50, min: 20, suffix: "step",
        default: 30,
        location: SettingsLocation.User
    }),

    new ChoiceSettingsOption({
        key: "model",
        name: "/imagine model",
        category: "image",
        emoji: { fallback: "💨" },
        description: "Which Stable Diffusion model to use",
        location: SettingsLocation.User,

        choices: STABLE_HORDE_AVAILABLE_MODELS.map(model => ({
			name: model.displayName ?? model.name,
            emoji: model.nsfw ? { fallback: "🔞" } : undefined,
            restricted: model.premium ? RestrictionType.PremiumOnly : undefined,
			value: model.name
		}))
    }),

    new ChoiceSettingsOption({
        key: "size",
        name: "/imagine image resolution/size",
        category: "image",
        emoji: { fallback: "📸" },
        description: "How big the generated images should be",
        location: SettingsLocation.User,

        choices: GENERATION_SIZES.map(({ width, height, premium }) => ({
            name: `${width}x${height} (${getAspectRatio(width, height)})`,
            value: `${width}:${height}:${premium}`,
            restricted: premium ? RestrictionType.PremiumOnly : undefined,
        }))
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

        choices: Languages.map(locale => ({
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
            description: "This setting changes whether the bot should send messages generated by ChatGPT while they're being generated, just like on the website. This does not affect generation speed or maximum generation length in any way."
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
            restricted: model.options.restricted,
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
        key: "model",
        name: "Video model",
        category: "video",
        emoji: { fallback: "📸" },
        description: "Which video generation model to use",
        location: SettingsLocation.User,

        choices: TuringVideoModels.map(model => ({
            name: model.name,
            value: model.id,
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

    new MultipleChoiceSettingsOption({
        key: "plugins",
        name: "Plugins",
        category: "alan",
        emoji: { fallback: "🧩" },
        description: "Which plugins to use",
        choices: alanOptions(TuringAlanPlugins, false),
        location: SettingsLocation.User
    }),

    new IntegerSettingsOption({
        key: "cooldown",
        name: "Cool-down for all users",
        category: "premium",
        emoji: { fallback: "⏰" },
        description: "Cool-down overwrite for users on the server",
        location: SettingsLocation.Guild,
        default: Math.floor(CONVERSATION_DEFAULT_COOLDOWN.time / 1000), min: 5, max: 300,
        suffix: "second",

        explanation: {
            description: "This setting will change the cool-down for all users, regardless of whether they have the **Premium**-restricted role configured above or not. Users who have their own Premium subscription will not be affected by this setting."
        }
    }),

    new RoleSettingsOption({
        key: "role",
        name: "Premium-restricted role",
        category: "premium",
        emoji: { fallback: "✨" },
        description: "Which role is only allowed to use Premium features of the bot",
        noneTooltip: "Don't lock Premium features to a specific role",

        explanation: {
            description: "Choosing a role for this setting will lock all Premium-unlocked features (*no cool-down, configurable token limit*, *etc.*) for a specific role. Users who don't have this role will simply use their own subscription, if they have one."
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
        default: 500, min: 50, max: 8192,
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
        name: "Show credit in toolbar",
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

export class UserSettingsManager {
    private readonly db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
        this.db = db;
    }

    private location(entry: SettingsDatabaseEntry): SettingsLocation {
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
        const get = (option: SettingsOption) => entry.settings ? this.get(entry, this.settingsString(option)) : undefined ?? this.template(this.location(entry))[this.settingsString(option)];
        const settings: Partial<DatabaseSettings> = {};

        for (const option of this.options(this.location(entry))) {
            settings[this.settingsString(option)] = get(option);
        }

        return settings as DatabaseSettings;
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

    public settingsOption<T extends SettingsOption = SettingsOption>(key: SettingKeyAndCategory | ReturnType<InstanceType<typeof UserSettingsManager>["settingsCategoryAndKey"]>): T | null {
        /* Extract the key & category from the specified option. */
        const data = typeof key === "string" ? this.settingsCategoryAndKey(key) : key;
        if (data === null) return null;

        return SettingOptions.find(s =>
            s.key === data.key && s.category === data.category.type
        ) as T ?? null;
    }

    public get<T extends any>(entry: SettingsDatabaseEntry, key: SettingKeyAndCategory): T {
        let value: T = entry.settings[key] as T ?? this.template(this.location(entry))[key];
        const option = this.settingsOption(key)!;

        if (option instanceof ChoiceSettingsOption) {
            /* If the current setting value is an invalid choice, reset it to the default again, */
            if (!option.data.choices.find(c => c.value === value)) value = this.template(this.location(entry))[key] as T;
        }

        return value;
    }

    public async apply<T extends SettingsDatabaseEntry>(entry: T, changes: Partial<Record<SettingKeyAndCategory, any>>): Promise<T> {
        if (this.db.bot.dev) this.db.bot.logger.debug("Apply settings ->", chalk.bold(entry.id), "->", `${chalk.bold(Object.values(changes).length)} changes`);

        const final: DatabaseSettings = {
            ...entry.settings,
            ...changes
        };

        for(const [ key, value ] of Object.entries(changes)) {
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

    public async handleInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
        /* Information about the interaction, e.g. update a setting or switch the page */
        const data: string[] = interaction.customId.split(":");
        data.shift();

        /* Type of settings action */
        const type: "page" | "current" | "change" | "menu" | "explanation" = data.shift()! as any;
        data.shift();

        /* Make sure that the button we're searching for actually exists. */
        if (interaction.message.components[interaction.message.components.length - 1].components.length < 2) return;

        const [ _, __, originRaw, categoryType ] = (interaction.message.components[interaction.message.components.length - 1] as ActionRow<ButtonComponent>)
            .components[1].customId!.split(":");

        const origin: SettingsLocation = originRaw as any;

        /* Database instances, guild & user */
        const db: DatabaseInfo = await this.db.users.fetchData(interaction.user, interaction.guild);

        let entry: SettingsDatabaseEntry = origin === SettingsLocation.Both
            ? db[origin as "guild" | "user"]!
            : origin === SettingsLocation.Guild ? db.guild! : db.user;
        
        const premium: boolean = this.db.users.canUsePremiumFeatures(db);

        if (type === "menu") {
            /* Category name & the actual category */
            const name: string = data.shift()!;

            const category: SettingsCategory | null = this.categories(origin).find(c => c.type === name) ?? null;
            if (category === null) return;

            return void await interaction.reply((await this.buildPage({
                category, interaction, db: entry
            })).get() as InteractionReplyOptions);
        }

        if (Date.now() - interaction.message.createdTimestamp > 5 * 60 * 1000) {
            return void await new ErrorResponse({
                interaction, message: `This settings menu can't be used anymore; run \`/settings\` again to continue`, emoji: "😔"
            }).send(interaction);
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

                const choice: ChoiceSettingOptionChoice | null = option.data.choices.find(c => c.value === newValueName) ?? null;
                if (choice === null) return;

                if (choice.restricted === RestrictionType.TesterOnly && !this.db.role.tester(db.user)) {
                    return void await new Response()
                        .addEmbed(builder => builder
                            .setDescription(`The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **testers**. ⚒️`)
                            .setColor("Orange")
                        )
                        .setEphemeral(true)
                    .send(interaction);
                }

                if (choice.restricted === RestrictionType.PremiumOnly && !premium) {
                    return void await new Response()
                        .addEmbed(builder => builder
                            .setDescription(`✨ The choice **${choice.name}**${choice.emoji ? ` ${typeof choice.emoji === "object" ? Emoji.display(choice.emoji, true) : choice.emoji}` : ""} is restricted to **Premium** users.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
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
                        updated[c.value] = newValueName === c.value ? !previous[newValueName] : previous[c.value];
                    })
                    
                    changes[key] = updated;
                }

            } else if (option instanceof IntegerSettingsOption || option instanceof StringSettingsOption) {
                const customID: string = `modal:${key}:${Date.now()}`;

                const modal: ModalBuilder = new ModalBuilder()
                    .setCustomId(customID)
                    .setTitle(`Change the setting 📝`)
                    .addComponents(
                        new ActionRowBuilder<TextInputBuilder>()
                            .addComponents(new TextInputBuilder()
                                .setCustomId("value")
                                .setRequired(true)
                                .setValue(previous.toString())
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Enter a new value...")
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
                    }, 30 * 1000);

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

                if (!interaction.replied) await interaction.update((await this.buildPage({
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

            await interaction.reply(response.get() as InteractionReplyOptions);

        } else if (type === "current") {
            await interaction.deferUpdate();
        }
    }
}