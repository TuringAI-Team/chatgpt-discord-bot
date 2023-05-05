import { APIApplicationCommandOptionChoice, ApplicationCommandOptionBase, AutocompleteInteraction, CacheType, SlashCommandSubcommandBuilder } from "discord.js";
import chalk from "chalk";

import { LoadingIndicatorManager, LoadingIndicators } from "../types/indicator.js";
import { GENERATION_SIZES, getAspectRatio } from "../../commands/imagine.js";
import { ChatSettingsModels } from "../../conversation/settings/model.js";
import { DatabaseUser, RawDatabaseUser, UserSettings } from "./user.js";
import { ChatSettingsTones } from "../../conversation/settings/tone.js";
import { CommandOptionChoice } from "../../command/command.js";
import { StableHordeModel } from "../../image/types/model.js";
import { Languages, UserLanguage } from "../types/locale.js";
import { DisplayEmoji, Emoji } from "../../util/emoji.js";
import { TuringVideoModels } from "../../turing/api.js";
import { DatabaseManager } from "../manager.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export interface SettingsCategory {
    /* Type of the category */
    type: SettingsCategoryName;

    /* Display name of the category */
    name: string;

    /* Emoji for this category */
    emoji: DisplayEmoji;
}

export type SettingsCategoryName = "general" | "image" | "video" | "chat"
export type SettingKeyAndCategory = `${SettingsCategoryName}:${SettingsName}`

export const SettingCategories: SettingsCategory[] = [
    {
        name: "General",
        type: "general",
        emoji: { fallback: "🧭" }
    },

    {
        name: "Image",
        type: "image",
        emoji: { fallback: "⛰️" }
    },

    {
        name: "Video",
        type: "video",
        emoji: { fallback: "📷" }
    },

    {
        name: "Chat",
        type: "chat",
        emoji: { fallback: "🗨️" }
    }
]

export enum SettingsOptionType {
    /* Simple true-false value */
    Boolean,

    /* Users can enter their own message */
    String,

    /* Users can choose from a list */
    Choices,

    /* Auto-complete choices list */
    AutoComplete,

    /* Users can type in a number, within a range */
    Number
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

    /* Default value of this settings option */
    default: T;
}

type SettingOptionsData<T = any> = Omit<BaseSettingsOptionData<T>, "type">

export abstract class SettingsOption<T = string | number | boolean, U extends BaseSettingsOptionData<T> = BaseSettingsOptionData<T>> {
    public readonly data: U;

    constructor(data: U) {
        this.data = data;
    }

    public abstract addToCommand(bot: Bot, builder: SlashCommandSubcommandBuilder): void;
    public abstract display(bot: Bot, value: T): string;

    protected applyBase<T extends ApplicationCommandOptionBase = ApplicationCommandOptionBase>(builder: T): T {
        builder
            .setName(this.key)
            .setDescription(`${this.data.name} ${this.data.emoji.fallback}`)
            .setRequired(false);
        
        return builder;
    }

    public get key(): SettingsName {
        return this.data.key;
    }

    public get category(): SettingsCategoryName {
        return this.data.category;
    }
}

export class BooleanSettingsOption extends SettingsOption<boolean> {
    constructor(data: SettingOptionsData) {
        super({
            ...data,
            type: SettingsOptionType.Boolean
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandSubcommandBuilder): void {
        builder.addBooleanOption(builder => this.applyBase(builder));
    }

    public display(bot: Bot, value: boolean): string {
        return value ? "Enabled ✅" : "Disabled ❌";
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

    public addToCommand(bot: Bot, builder: SlashCommandSubcommandBuilder): void {
        builder.addIntegerOption(builder => this.applyBase(builder)
            .setMinValue(this.data.min)
            .setMaxValue(this.data.max)
        );
    }

    public display(bot: Bot, value: number): string {
        return `\`${value}\`${this.data.suffix ? ` ${this.data.suffix}${value > 1 || value === 0 ? "s" : ""}` : ""}`;
    }
}

type ChoiceSettingOptionChoice = APIApplicationCommandOptionChoice<string> & {
    /* Overwrite for the actual name; what to display in the settings menu */
    display?: string;

    /* Whether this option is restricted to Premium users */
    premium: boolean;
}

interface ChoiceSettingOptionData {
    choices: ChoiceSettingOptionChoice[];
}

export class ChoiceSettingsOption extends SettingsOption<string, BaseSettingsOptionData & ChoiceSettingOptionData> {
    constructor(data: SettingOptionsData & ChoiceSettingOptionData) {
        super({
            ...data,
            type: SettingsOptionType.Choices
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandSubcommandBuilder): void {
        builder.addStringOption(builder => this.applyBase(builder)
            .addChoices(...this.data.choices.map(({ name, premium, value }) => ({
                name: premium ? `${name} (premium-only ✨)` : name,
                value
            })))
        );
    }

    public displayForID(id: string): ChoiceSettingOptionChoice {
        return this.data.choices.find(c => c.value === id)!;
    }

    public display(bot: Bot, value: string): string {
        const choice: ChoiceSettingOptionChoice = this.displayForID(value);
        return choice.display ?? choice.name;
    }
}

export abstract class AutocompleteChoiceSettingsOption extends SettingsOption<string, BaseSettingsOptionData> {
    constructor(data: SettingOptionsData) {
        super({
            ...data,
            type: SettingsOptionType.AutoComplete
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandSubcommandBuilder): void {
        builder.addStringOption(builder => this.applyBase(builder)
            .setAutocomplete(true)
        );
    }

    public abstract complete(bot: Bot, interaction: AutocompleteInteraction, value: string): CommandOptionChoice<string>[];
    public abstract displayForID(bot: Bot, id: string): string | null;
    public abstract valid(bot: Bot, id: string): boolean;

    public display(bot: Bot, value: string): string {
        return this.displayForID(bot, value) ?? "❓";
    }
}

export class ImagineModelAutocompleteSettingsOption extends AutocompleteChoiceSettingsOption {
    constructor() {
        super({
            key: "model",
            name: "/imagine model",
            category: "image",
            emoji: { fallback: "💨" },
            description: "Which Stable Diffusion model to use",
            default: "stable_diffusion"
        });
    }

    public complete(bot: Bot, interaction: AutocompleteInteraction<CacheType>, value: string): CommandOptionChoice<string>[] {
		/* Get all available Stable Diffusion models. */
		const models: StableHordeModel[] = bot.image.getModels(value.toLowerCase())
			.filter(model => bot.image.shouldShowModel(interaction, model));

		return models.map(model => ({
			name: Utils.truncate(`${bot.image.displayNameForModel(model)}${bot.image.isModelNSFW(model) ? " 🔞" : ""} » ${bot.image.descriptionForModel(model)}`, 100),
			value: model.name
		}));
    }

    public displayForID(bot: Bot, id: string): string | null {
        const model: StableHordeModel | null = bot.image.getModels().find(m => m.name === id) ?? null;
        if (model === null) return null;

        return `**${bot.image.displayNameForModel(model)}**${bot.image.isModelNSFW(model) ? " 🔞" : ""}`;
    }

    public valid(bot: Bot, id: string): boolean {
        return bot.image.getModels().find(m => m.name === id) != undefined;
    }
}

export class LanguageAutocompleteSettingsOption extends AutocompleteChoiceSettingsOption {
    constructor() {
        super({
            key: "language",
            name: "Language",
            category: "general",
            emoji: { fallback: "🌐" },
            description: "Primary language to use for the bot",
            default: "en-US"
        });
    }

    public complete(): CommandOptionChoice<string>[] {
		return Languages.map(locale => {
            return {
    			name: `${locale.name} (${locale.id})`,
			    value: locale.id
		    };
        });
    }

    public displayForID(bot: Bot, id: string): string | null {
        const locale: UserLanguage | null = Languages.find(l => l.id === id) ?? null;
        if (locale === null) return null;

        return `${locale.name} ${locale.emoji}`;
    }

    public valid(bot: Bot, id: string): boolean {
        return Languages.find(l => l.id === id) != undefined;
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
        default: 2
    }),

    new IntegerSettingsOption({
        key: "steps",
        name: "/imagine generations steps",
        category: "image",
        emoji: { fallback: "🖼️" },
        description: "How many steps to generate with",
        max: 50, min: 5, suffix: "step",
        default: 30
    }),

    new ImagineModelAutocompleteSettingsOption(),

    new ChoiceSettingsOption({
        choices: GENERATION_SIZES.map(({ width, height, premium }) => ({
            name: `${width}x${height} (${getAspectRatio(width, height)})`,
            value: `${width}:${height}:${premium}`,
            premium: premium
        })),

        key: "size",
        name: "/imagine image resolution/size",
        category: "image",
        emoji: { fallback: "📸" },
        description: "How big the generated images should be",
        default: "512:512:false"
    }),

    new BooleanSettingsOption({
        key: "partial_messages",
        name: "Partial messages",
        category: "chat",
        emoji: { fallback: "⏳" },
        description: "Whether chat messages by the bot should be shown while they're being generated",
        default: true
    }),

    new ChoiceSettingsOption({
        key: "model",
        name: "Model",
        category: "chat",
        emoji: { fallback: "🤖" },
        description: "Which language model to use for chatting",
        default: "chatgpt",

        choices: ChatSettingsModels.map(model => ({
            display: `**${model.options.name}** ${Emoji.display(model.options.emoji, true)} • ${model.options.description}`,
            name: `${model.options.name} ${model.options.emoji.fallback} • ${model.options.description}`,
            premium: model.options.premium,
            value: model.id
        }))
    }),

    new ChoiceSettingsOption({
        key: "tone",
        name: "Tone",
        category: "chat",
        emoji: { fallback: "🗣️" },
        description: "Which tone to use for chatting",
        default: "neutral",

        choices: ChatSettingsTones.map(tone => ({
            display: `**${tone.options.name}** ${Emoji.display(tone.options.emoji, true)} • ${tone.options.description}`,
            name: `${tone.options.name} ${tone.options.emoji.fallback} • ${tone.options.description}`,
            premium: tone.options.premium,
            value: tone.id
        }))
    }),

    new ChoiceSettingsOption({
        key: "loading_indicator",
        name: "Loading indicator",
        category: "general",
        emoji: { display: "<a:loading:1051419341914132554>", fallback: "🔃" },
        description: "Which loading indicator to use throughout the bot, and for partial messages",
        default: LoadingIndicators[0].emoji.id,

        choices: LoadingIndicators.map(indicator => ({
            display: `${indicator.name} ${LoadingIndicatorManager.toString(indicator)}`,
            name: indicator.name,
            value: indicator.emoji.id,
            premium: false
        }))
    }),

    new ChoiceSettingsOption({
        key: "model",
        name: "Video model",
        category: "video",
        emoji: { fallback: "📸" },
        description: "Which video generation model to use",
        default: TuringVideoModels[0].id,

        choices: TuringVideoModels.map(model => ({
            name: model.name,
            value: model.id,
            premium: false
        }))
    }),

    new LanguageAutocompleteSettingsOption()
]

export class UserSettingsManager {
    private readonly db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    public options(category?: SettingsCategory): SettingsOption[] {
        return SettingOptions
            .filter(s => category ? s.category === category.type : true);
    }

    public categories(): SettingsCategory[] {
        return SettingCategories;
    }

    public template(): UserSettings {
        const settings: Partial<UserSettings> = {};

        for (const option of SettingOptions) {
            settings[this.settingsString(option)] = option.data.default;
        }

        return settings as UserSettings;
    }

    public load(raw: DatabaseUser | RawDatabaseUser): UserSettings {
        const get = (option: SettingsOption) => raw.settings ? raw.settings[this.settingsString(option)] : undefined ?? this.template()[this.settingsString(option)];
        const settings: Partial<UserSettings> = {};

        for (const option of SettingOptions) {
            settings[this.settingsString(option)] = get(option);
        }

        return settings as UserSettings;
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

    public settingsOption(key: SettingKeyAndCategory | ReturnType<InstanceType<typeof UserSettingsManager>["settingsCategoryAndKey"]>): SettingsOption | null {
        /* Extract the key & category from the specified option. */
        const data = typeof key === "string" ? this.settingsCategoryAndKey(key) : key;
        if (data === null) return null;

        return SettingOptions.find(s =>
            s.key === data.key && s.category === data.category.type
        ) ?? null;
    }

    public get<T extends string | number | boolean>(user: DatabaseUser, option: SettingsOption | SettingKeyAndCategory): T {
        return user.settings[this.settingsString(option)] as T;
    }

    public async apply(user: DatabaseUser, changes: Partial<Record<SettingKeyAndCategory, any>>): Promise<void> {
        if (this.db.bot.dev) this.db.bot.logger.debug("Apply settings ->", chalk.bold(user.id), "->", `${chalk.bold(Object.values(changes).length)} changes`);

        const final: UserSettings = {
            ...user.settings,
            ...changes
        };

        /* Apply all the changes. */
        await this.db.users.updateUser(user, {
            settings: final
        });
    }
}