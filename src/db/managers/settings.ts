import { APIApplicationCommandOptionChoice, ApplicationCommandOptionBase, AutocompleteInteraction, CacheType, SlashCommandBuilder } from "discord.js";
import LocaleCodes from "locale-code";
import chalk from "chalk";

import { GENERATION_SIZES, getAspectRatio } from "../../commands/imagine.js";
import { DatabaseUser, RawDatabaseUser, UserSettings } from "./user.js";
import { CommandOptionChoice } from "../../command/command.js";
import { StableHordeModel } from "../../image/types/model.js";
import { ToneEmoji } from "../../conversation/tone.js";
import { DatabaseManager } from "../manager.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";


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

    /* Emoji for the settings option */
    emoji: ToneEmoji;

    /* Description of the settings option */
    description: string;

    /* Type of the setting */
    type: SettingsOptionType;

    /* Default value of this settings option */
    default: T;
}

type SettingOptionsData<T = any> = Omit<BaseSettingsOptionData, "type">

export abstract class SettingsOption<T = string | number | boolean, U extends BaseSettingsOptionData<T> = BaseSettingsOptionData<T>> {
    public readonly data: U;

    constructor(data: U) {
        this.data = data;
    }

    public abstract addToCommand(bot: Bot, builder: SlashCommandBuilder): void;
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
}

export class BooleanSettingsOption extends SettingsOption<boolean> {
    constructor(data: SettingOptionsData) {
        super({
            ...data,
            type: SettingsOptionType.Boolean
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandBuilder): void {
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

    public addToCommand(bot: Bot, builder: SlashCommandBuilder): void {
        builder.addIntegerOption(builder => this.applyBase(builder)
            .setMinValue(this.data.min)
            .setMaxValue(this.data.max)
        );
    }

    public display(bot: Bot, value: number): string {
        return `\`${value}\`${this.data.suffix ? ` ${this.data.suffix}${value > 1 || value === 0 ? "s" : ""}` : ""}`;
    }
}

interface ChoiceSettingOptionData {
    choices: (APIApplicationCommandOptionChoice<string> & {
        premium: boolean;
    })[];
}

export class ChoiceSettingsOption extends SettingsOption<string, BaseSettingsOptionData & ChoiceSettingOptionData> {
    constructor(data: SettingOptionsData & ChoiceSettingOptionData) {
        super({
            ...data,
            type: SettingsOptionType.Choices
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandBuilder): void {
        builder.addStringOption(builder => this.applyBase(builder)
            .addChoices(...this.data.choices.map(({ name, premium, value }) => ({
                name: premium ? `${name} ✨` : name,
                value
            })))
        );
    }

    public displayForID(id: string): APIApplicationCommandOptionChoice {
        return this.data.choices.find(c => c.value === id)!;
    }

    public display(bot: Bot, value: string): string {
        const choice: APIApplicationCommandOptionChoice = this.displayForID(value);
        return choice.name;
    }
}

export abstract class AutocompleteChoiceSettingsOption extends SettingsOption<string, BaseSettingsOptionData> {
    constructor(data: SettingOptionsData) {
        super({
            ...data,
            type: SettingsOptionType.AutoComplete
        });
    }

    public addToCommand(bot: Bot, builder: SlashCommandBuilder): void {
        builder.addStringOption(builder => this.applyBase(builder)
            .setAutocomplete(true)
        );
    }

    public abstract complete(bot: Bot, interaction: AutocompleteInteraction, value: string): CommandOptionChoice<string>[];
    public abstract displayForID(bot: Bot, id: string): string;
    public abstract valid(bot: Bot, id: string): boolean;

    public display(bot: Bot, value: string): string {
        return this.displayForID(bot, value);
    }
}

export class ImagineModelAutocompleteSettingsOption extends AutocompleteChoiceSettingsOption {
    constructor() {
        super({
            key: "image_model",
            name: "/imagine model",
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

    public displayForID(bot: Bot, id: string): string {
        const model: StableHordeModel | null = bot.image.getModels().find(m => m.name === id) ?? null;
        if (model === null) return "❓";

        return `**${bot.image.displayNameForModel(model)}**${bot.image.isModelNSFW(model) ? " 🔞" : ""}`;
    }

    public valid(bot: Bot, id: string): boolean {
        return bot.image.getModels().find(m => m.name === id) != undefined;
    }
}

export type GetSettingsTypeParameter<T> = T extends SettingsOption<infer R> ? R : never
export type SettingsName = "image_count" | "image_steps" | "image_model" | "image_size" | "partial_messages" | "language"

const SETTINGS_OPTION_LANGUAGES: string[] = [
    "en-US", "es-ES", "fr-FR", "de-DE", "it-IT", "ja-JP", "ko-KR", "pt-BR", "ru-RU", "zh-CN", "zh-TW"
] 

export const SettingOptions: Record<SettingsName, SettingsOption> = {
    image_count: new IntegerSettingsOption({
        key: "image_count",
        name: "/imagine image count",
        emoji: { fallback: "🔢" },
        description: "How many images to generate",
        max: 4, min: 1, suffix: "image",
        default: 2
    }),

    image_steps: new IntegerSettingsOption({
        key: "image_steps",
        name: "/imagine generations steps",
        emoji: { fallback: "🖼️" },
        description: "How many steps to generate with",
        max: 50, min: 5, suffix: "step",
        default: 30
    }),

    image_model: new ImagineModelAutocompleteSettingsOption(),

    image_size: new ChoiceSettingsOption({
        choices: GENERATION_SIZES.map(({ width, height, premium }) => ({
            name: `${width}x${height} (${getAspectRatio(width, height)})`,
            value: `${width}:${height}:${premium}`,
            premium: premium
        })),

        key: "image_size",
        name: "/imagine image resolution/size",
        emoji: { fallback: "📸" },
        description: "How big the generated images should be",
        default: "512:512:false"
    }),

    partial_messages: new BooleanSettingsOption({
        key: "partial_messages",
        name: "Partial messages",
        emoji: { fallback: "⏳" },
        description: "Whether messages by the bot should be shown while they're being generated",
        default: false
    }),

    language: new ChoiceSettingsOption({
        choices: SETTINGS_OPTION_LANGUAGES.map(code => {
            return {
                name: `${LocaleCodes.getLanguageName(code)} (${code})`,
                value: code,
                premium: false
            }
        }),

        key: "language",
        name: "Language",
        emoji: { fallback: "🌐" },
        description: "Language to use for various features of the bot",
        default: "en-US"
    })
}

export class UserSettingsManager {
    private readonly db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    public options(): SettingsOption[] {
        return Object.values(SettingOptions);
    }

    public template(): UserSettings {
        const settings: Partial<UserSettings> = {};

        for (const [key, option] of Object.entries(SettingOptions)) {
            settings[key as SettingsName] = option.data.default;
        }

        return settings as UserSettings;
    }

    public load(raw: DatabaseUser | RawDatabaseUser): UserSettings {
        const get = (key: SettingsName) => raw.settings[key] ?? this.template()[key];
        const settings: Partial<UserSettings> = {};

        for (const key of Object.keys(SettingOptions)) {
            settings[key as SettingsName] = get(key as SettingsName);
        }

        return settings as UserSettings;
    }

    public get<T extends string | number | boolean>(user: DatabaseUser, option: SettingsOption | SettingsName): T {
        return user.settings[typeof option === "string" ? option : option.key] as T;
    }

    public async apply(user: DatabaseUser, changes: Partial<Record<SettingsName, any>>): Promise<void> {
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