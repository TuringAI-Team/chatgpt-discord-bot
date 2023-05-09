import { APIApplicationCommandOptionChoice, ActionRow, ActionRowBuilder, Awaitable, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ComponentEmojiResolvable, Interaction, InteractionReplyOptions, InteractionUpdateOptions, ModalBuilder, SelectMenuComponentOptionData, StringSelectMenuBuilder, StringSelectMenuInteraction, TextInputBuilder, TextInputStyle } from "discord.js";
import chalk from "chalk";

import { TuringAlanImageGenerators, TuringAlanImageModifiers, TuringAlanPlugins, TuringAlanSearchEngines, TuringVideoModels, alanOptions } from "../../turing/api.js";
import { DatabaseInfo, DatabaseUser, UserSettings, UserTestingGroup } from "./user.js";
import { LoadingIndicatorManager, LoadingIndicators } from "../types/indicator.js";
import { GENERATION_SIZES, getAspectRatio } from "../../commands/imagine.js";
import { STABLE_HORDE_AVAILABLE_MODELS } from "../../image/types/model.js";
import { ChatSettingsModels } from "../../conversation/settings/model.js";
import { ChatSettingsTones } from "../../conversation/settings/tone.js";
import { Conversation } from "../../conversation/conversation.js";
import { ErrorResponse } from "../../command/response/error.js";
import { RestrictionType } from "../types/restriction.js";
import { DisplayEmoji, Emoji } from "../../util/emoji.js";
import { ClientDatabaseManager } from "../cluster.js";
import { Response } from "../../command/response.js";
import { Languages } from "../types/locale.js";
import { Bot } from "../../bot/bot.js";

export interface SettingsCategory {
    /* Type of the category */
    type: SettingsCategoryName;

    /* Display name of the category */
    name: string;

    /* Emoji for this category */
    emoji: DisplayEmoji;
}

export type SettingsCategoryName = "general" | "image" | "video" | "chat" | "alan"
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
        name: "Alan",
        type: "alan",
        emoji: { display: "<:turing_neon:1100498729414434878>", fallback: "🧑‍💻" }
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

    /* Handler to execute when this setting is changed */
    handler?: (bot: Bot, user: DatabaseUser, value: T) => Awaitable<void>;

    /* Default value of this settings option */
    default: T;
}

type SettingOptionsData<T = any> = Omit<BaseSettingsOptionData<T>, "type">

export abstract class SettingsOption<T extends any = any, U extends BaseSettingsOptionData<T> = BaseSettingsOptionData<T>> {
    public readonly data: U;

    constructor(data: U) {
        this.data = data;
    }

    public abstract add(
        bot: Bot, builder: ActionRowBuilder, current: T
    ): ActionRowBuilder;

    protected applyBase(builder: ActionRowBuilder): ActionRowBuilder {
        builder.addComponents(
            new ButtonBuilder()
                .setLabel(this.data.name)
                .setEmoji(Emoji.display(this.data.emoji, true) as ComponentEmojiResolvable)
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(this.customID(this.data.name))
                .setDisabled(true)
        );
        
        return builder;
    }

    protected customID(value?: string | number | boolean): string {
        return `settings:change:${this.key}${value != undefined ? `:${value}` : ""}`;
    }

    public async handle(bot: Bot, user: DatabaseUser, value: T): Promise<void> {
        if (this.data.handler) await this.data.handler(bot, user, value);
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

    public add(bot: Bot, builder: ActionRowBuilder, current: boolean): ActionRowBuilder {
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

    public add(bot: Bot, builder: ActionRowBuilder, current: number): ActionRowBuilder {
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

    public add(bot: Bot, builder: ActionRowBuilder, current: string): ActionRowBuilder {
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

    public add(bot: Bot, builder: ActionRowBuilder, current: string): ActionRowBuilder {
        return builder
            .addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId(this.customID())
                    .setPlaceholder(`${this.data.name} ${Emoji.display(this.data.emoji)}`)
                    .addOptions(...this.data.choices.map(({ name, value, description, emoji, restricted }) => ({
                        emoji: emoji ? typeof emoji === "string" ? emoji : Emoji.display(emoji, true) : undefined,
                        description: restricted ? `${description ?? ""} (${restricted === RestrictionType.PremiumOnly ? "premium-only ✨" : "tester-only ⚒️"})` : description,
                        default: value === current,
                        label: name, value
                    }) as SelectMenuComponentOptionData))
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

    public add(bot: Bot, builder: ActionRowBuilder, current: MultipleChoiceSettingsObject): ActionRowBuilder {
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
        max: 50, min: 20, suffix: "step",
        default: 30
    }),

    new ChoiceSettingsOption({
        key: "model",
        name: "/imagine model",
        category: "image",
        emoji: { fallback: "💨" },
        description: "Which Stable Diffusion model to use",

        choices: STABLE_HORDE_AVAILABLE_MODELS.map(model => ({
			name: model.displayName ?? model.name,
            emoji: model.nsfw ? { fallback: "🔞" } : undefined,
			value: model.name
		})),
    }),

    new ChoiceSettingsOption({
        key: "size",
        name: "/imagine image resolution/size",
        category: "image",
        emoji: { fallback: "📸" },
        description: "How big the generated images should be",

        choices: GENERATION_SIZES.map(({ width, height, premium }) => ({
            name: `${width}x${height} (${getAspectRatio(width, height)})`,
            value: `${width}:${height}:${premium}`,
            premium: premium
        }))
    }),

    new ChoiceSettingsOption({
        choices: Languages.map(locale => ({
            name: locale.name,
            emoji: { fallback: locale.emoji },
            value: locale.id
        })),

        key: "language",
        name: "Language",
        category: "general",
        emoji: { fallback: "🌐" },
        description: "Primary language to use for the bot",
        default: "en-US"
    }),

    new BooleanSettingsOption({
        key: "partialMessages",
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

            await conversation.reset(false);
        }
    }),

    new ChoiceSettingsOption({
        key: "tone",
        name: "Tone",
        category: "chat",
        emoji: { fallback: "🗣️" },
        description: "Which tone to use for chatting",

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

            await conversation.reset(false);
        }
    }),

    new ChoiceSettingsOption({
        key: "loadingIndicator",
        name: "Loading indicator",
        category: "general",
        emoji: { display: LoadingIndicatorManager.toString(LoadingIndicators[0]), fallback: "🔃" },
        description: "Which loading indicator to use throughout the bot, and for partial messages",

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
        choices: alanOptions(TuringAlanSearchEngines)
    }),

    new ChoiceSettingsOption({
        key: "imageGenerator",
        name: "Image generator",
        category: "alan",
        emoji: { fallback: "🖨️" },
        description: "Which image generator to use",
        choices: alanOptions(TuringAlanImageGenerators)
    }),

    new ChoiceSettingsOption({
        key: "imageModifier",
        name: "Image modifier",
        category: "alan",
        emoji: { fallback: "🖌️" },
        description: "Which image modifier to use",
        choices: alanOptions(TuringAlanImageModifiers)
    }),

    new MultipleChoiceSettingsOption({
        key: "plugins",
        name: "Plugins",
        category: "alan",
        emoji: { fallback: "🧩" },
        description: "Which plugins to use",
        choices: alanOptions(TuringAlanPlugins, false)
    })
]

interface SettingsPageBuilderOptions {
    /* Database user instance */
    db: DatabaseInfo;

    /* Category of the current page */
    category: SettingsCategory;
}

export class UserSettingsManager {
    private readonly db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
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

    public load(raw: DatabaseUser): UserSettings {
        const get = (option: SettingsOption) => raw.settings ? this.get(raw, this.settingsString(option)) : undefined ?? this.template()[this.settingsString(option)];
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

    public get<T extends any>(user: DatabaseUser, key: SettingKeyAndCategory): T {
        let value: T = user.settings[key] as T ?? this.template()[key];
        const option = this.settingsOption(key)!;

        if (option instanceof ChoiceSettingsOption) {
            /* If the current setting value is an invalid choice, reset it to the default again, */
            if (!option.data.choices.find(c => c.value === value)) value = this.template()[key] as T;
        }

        return value;
    }

    public async apply(user: DatabaseUser, changes: Partial<Record<SettingKeyAndCategory, any>>): Promise<DatabaseUser> {
        if (this.db.bot.dev) this.db.bot.logger.debug("Apply settings ->", chalk.bold(user.id), "->", `${chalk.bold(Object.values(changes).length)} changes`);

        const final: UserSettings = {
            ...user.settings,
            ...changes
        };

        for(const [ key, value ]  of Object.entries(changes)) {
            const option = this.settingsOption(key as SettingKeyAndCategory)!;
            await option.handle(this.db.bot, user, value);
        }

        /* Apply all the changes and return the updated database user instance. */
        return await this.db.users.updateUser(user, {
            settings: final
        });
    }

    public buildPageSwitcher(current: SettingsCategory): ActionRowBuilder<ButtonBuilder> {
        /* Current category index */
        const currentIndex: number = this.categories().findIndex(c => c.type === current.type);

        /* Page switcher row builder */
        const row = new ActionRowBuilder<ButtonBuilder>();

        row.addComponents(
            new ButtonBuilder()
                .setEmoji("◀️").setStyle(ButtonStyle.Secondary)
                .setCustomId("settings:page:-1")
                .setDisabled(currentIndex - 1 < 0),

            new ButtonBuilder()
                .setLabel(current.name)
                .setEmoji(Emoji.display(current.emoji, true) as ComponentEmojiResolvable)
                .setCustomId(`settings:current:${current.type}`)
                .setStyle(ButtonStyle.Success)
                .setDisabled(true),

            new ButtonBuilder()
                .setEmoji("▶️").setStyle(ButtonStyle.Secondary)
                .setCustomId("settings:page:1")
                .setDisabled(currentIndex + 1 > this.categories().length - 1)
        );

        return row;
    }

    public buildPage({ db, category }: SettingsPageBuilderOptions): Response {
        /* Page switcher row */
        const switcher = this.buildPageSwitcher(category);

        /* Options for this category */
        const options: SettingsOption[] = this.options(category);

        /* Final response */
        const response: Response = new Response()
            .setEphemeral(true);

        for (const option of options) {
            /* Current value of this option */
            const key = this.settingsString(option);
            const current = this.get(db.user, key);

            /* Create the button row. */
            const row: ActionRowBuilder = option.add(this.db.bot, new ActionRowBuilder(), current);
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
        const type: "page" | "current" | "change" | "menu" = data.shift()! as any;

        /* Database instances, guild & user */
        const db: DatabaseInfo = await this.db.users.fetchData(interaction.user, interaction.guild);
        const premium: boolean = this.db.users.canUsePremiumFeatures(db);

        if (type === "menu") {
            /* Category name & the actual category */
            const name: string = data.shift()!;

            const category: SettingsCategory | null = this.categories().find(c => c.type === name) ?? null;
            if (category === null) return;

            return void await interaction.reply(this.buildPage({
                category, db
            }).get() as InteractionReplyOptions);
        }

        if (Date.now() - interaction.message.createdTimestamp > 5 * 60 * 1000) {
            return void await new ErrorResponse({
                interaction, message: `This settings menu can't be used anymore; run \`/settings\` again to continue`, emoji: "😔"
            }).send(interaction);
        }

        const categoryType: string = (interaction.message.components[interaction.message.components.length - 1] as ActionRow<ButtonComponent>)
            .components[1].customId!.split(":").pop()!;

        /* Current settings category & index */
        const category: SettingsCategory | null = this.categories().find(c => c.type === categoryType) ?? null;
        const categoryIndex: number = this.categories().findIndex(c => c.type === categoryType);

        if (category === null) return;

        /* Change the page */
        if (type === "page") {
            /* How to switch the pages, either -1 or (+)1 */
            const delta: number = parseInt(data.shift()!);

            /* New category to switch to */
            const newCategory: SettingsCategory | null = this.categories().at(categoryIndex + delta) ?? null;
            if (newCategory === null) return;
            
            await interaction.update(this.buildPage({
                category: newCategory, db
            }).get() as InteractionUpdateOptions);

        /* Update a setting */
        } else if (type === "change") {
            /* Key of the setting */
            const rawKey: string = data.shift()!;
            const key: SettingKeyAndCategory = `${category.type}:${rawKey}`;

            /* The settings option itself */
            const option: SettingsOption | null = this.options(category)
                .find(o => o.key === rawKey) ?? null;

            if (option === null) return;

            /* New value of this setting, if applicable */
            const newValue: string | null = data.shift() ?? null;
            const previous: any = this.get(db.user, key);

            /* Final changes to the settings */
            let changes: Partial<Record<SettingKeyAndCategory, any>> = {};

            if (option instanceof BooleanSettingsOption) {
                changes[key] = newValue === "true";

            } else if ((option instanceof ChoiceSettingsOption || option instanceof MultipleChoiceSettingsOption) && interaction instanceof StringSelectMenuInteraction) {
                const newValueName: string = interaction.values[0];

                const choice: ChoiceSettingOptionChoice | null = option.data.choices.find(c => c.value === newValueName) ?? null;
                if (choice === null) return;

                if (choice.restricted === RestrictionType.TesterOnly && db.user.tester === UserTestingGroup.None) {
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
                const modal: ModalBuilder = new ModalBuilder()
                    .setCustomId("settings-modal")
                    .setTitle(`Change the setting 📝`)
                    .addComponents(
                        new ActionRowBuilder<TextInputBuilder>()
                            .addComponents(new TextInputBuilder()
                                .setCustomId("value")
                                .setRequired(true)
                                .setValue(previous.toString())
                                .setStyle(TextInputStyle.Short)
                                .setPlaceholder("Enter a new value...")
                                .setLabel(`${option.data.name} (${option.data.type === SettingsOptionType.String ? `${option.data.min}-${option.data.max} characters` : `${option.data.min}-${option.data.max}`})`)
                                .setMinLength(option.data.type === SettingsOptionType.String ? option.data.min : 1)
                                .setMaxLength(option.data.type === SettingsOptionType.String ? option.data.max : 2)
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
                        if (!interaction.isModalSubmit() || interaction.user.id !== db.user.id) return;

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
                db.user = await this.apply(db.user, changes);

                if (!interaction.replied) await interaction.update(this.buildPage({
                    category, db
                }).get() as InteractionUpdateOptions);
            } else {
                if (!interaction.replied) await interaction.deferUpdate();
            }

        } else if (type === "current") {
            await interaction.deferUpdate();
        }
    }
}