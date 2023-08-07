import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, MessageEditOptions, ModalActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, User, StringSelectMenuBuilder, StringSelectMenuInteraction, Collection, Snowflake, TextChannel, Guild, Channel, Message, InteractionResponse, MessageCreateOptions, ChatInputCommandInteraction, ComponentType, APIEmbedField } from "discord.js";
import translate from "@iamtraction/google-translate";
import { randomUUID } from "crypto";
import dayjs from "dayjs";

import { DatabaseInfraction, DatabaseInfractionOptions, DatabaseInfractionReference, DatabaseUserInfractionTypeMap } from "./types/infraction.js";
import { ModerationFilterActionData, ModerationFilterActionType, FilterManager } from "./filter/manager.js";
import { InteractionHandlerClassType, InteractionHandlerResponse } from "../interaction/handler.js";
import { ModerationInteractionHandlerData } from "../interactions/moderation.js";
import { DatabaseEntry, DatabaseInfo } from "../db/managers/user.js";
import { Response, ResponseSendClass } from "../command/response.js";
import { ImageModel } from "../image/types/model.js";
import { DatabaseUser } from "../db/schemas/user.js";
import { FindResult, Utils } from "../util/utils.js";
import { Duration } from "dayjs/plugin/duration.js";
import { Config } from "../config.js";
import { Bot } from "../bot/bot.js";

import relativeTime from "dayjs/plugin/relativeTime.js";
import duration from "dayjs/plugin/duration.js";

dayjs.extend(relativeTime);
dayjs.extend(duration);

const ActionToEmoji: Record<string, string> = {
	warn: "⚠️",
	ban: "🔨",
	unban: "🙌",
	moderation: "🤨",
    block: "⛔",
    flag: "🚩"
}

const FlagToEmoji: Record<string, string> = {
    chatBot: "🤖",
    describe: "🔎",
    image: "🖼️",
    video: "📸",
    music: "🎶",
    translationPrompt: "🌐",
    translationResult: "🌐",
    youTubeQuery: "▶️",
    chatUser: "👤",

    /* Backwards compatibility with old flags */
    user: "👤",
    bot: "🤖" 
}

const FlagToName: Record<string, string> = {
    chatBot: "Bot response",
    describe: "Image description",
    image: "Image prompt",
    video: "Video prompt",
    music: "Music prompt",
    translationPrompt: "Translation prompt",
    translationResult: "Translation result",
    youTubeQuery: "YouTube search query",
    chatUser: "User message"
}

type QuickActionType = "warn" | "ban"

interface QuickAction {
    reason: string;
    type?: QuickActionType;
    duration?: Duration;
}

const QuickReasons: QuickAction[] = [
    { reason: "Inappropriate use of the bot" },
    { reason: "This is your only warning", type: "warn" },
    { reason: "This is your last warning", type: "warn" },
    { reason: "If you need help, talk to someone that cares for you" },
    { reason: "Joking about self-harm/suicide", duration: dayjs.duration({ days: 3 }) },
    { reason: "Self-harm/suicide-related content", duration: dayjs.duration({ days: 7 }) },
    { reason: "Sexual content", duration: dayjs.duration({ days: 7 }) },
    { reason: "Sexual content involving minors" },
    { reason: "Gore/violent content" },
    { reason: "Incest-related content" },
    { reason: "Racist content", duration: dayjs.duration({ days: 7 }) },
    { reason: "Trolling" },
    { reason: "Tricking bot into generating inappropriate content" },
    { reason: "Using bot to generate inappropriate content" }
]

export type ModerationToolbarAction = "ban" | "warn" | "view" | "quick" | "lock"

type ModerationSendOptions = ModerationOptions & {
    infraction: DatabaseInfraction | null;
    result: ModerationResult;
    content: string;
    notice?: string;
}

export type ModerationSource = "chatUser" | "chatBot" | "image" | "translationPrompt" | "translationResult" | "describe" | "video" | "music" | "youTubeQuery"

interface AdditionalModerationOptions {
    /* Which image generation model was used */
    model?: ImageModel;
}

export interface ModerationOptions {
    user: User;
    db: DatabaseInfo;

    source: ModerationSource;
    content: string;

    additional?: AdditionalModerationOptions;
}

export interface ModerationNoticeOptions {
    result: ModerationResult;
    original?: ResponseSendClass;
    name: string;
    small?: boolean;
}

export interface ModerationInfractionOverviewOptions {
    reference?: boolean;
    by?: boolean;
}

export interface ModerationWarningModalOptions<T extends DatabaseEntry> {
    interaction: Message | ChatInputCommandInteraction | InteractionHandlerClassType;
    db: T;
}

type ImagePromptModerationOptions = Pick<ModerationOptions, "db" |  "user" | "content"> & AdditionalModerationOptions

export interface ModerationTranslationResult {
    /* Translated content */
    content: string;

    /* Detected language */
    detected: string;
}

export interface ModerationResult {
    /* Translated flagged content */
    translation?: ModerationTranslationResult;

    /* Whether the message was flagged */
    flagged: boolean;

    /* Whether the message should be completely blocked */
    blocked: boolean;

    /* Auto moderation filter result */
    auto?: ModerationFilterActionData;

    /* The received infraction, if applicable */
    infraction?: DatabaseInfraction;

    /* Source of the moderation request */
    source: ModerationSource;
}

export class ModerationManager {
    private readonly bot: Bot;

    /* Filter manager */
    public readonly filter: FilterManager;

    constructor(bot: Bot) {
        this.bot = bot;

        /* Initialize all other sub-managers. */
        this.filter = new FilterManager(this.bot);
    }

    /**
     * Handle an interaction, in the moderation channel.
     * @param original Interaction to handle
     */
    public async handleInteraction(original: ButtonInteraction | StringSelectMenuInteraction, { action, id, quickAction }: ModerationInteractionHandlerData): InteractionHandlerResponse {
        if (original.channelId !== this.bot.app.config.channels.moderation.channel) return;

        /* Fetch the original author. */
        const author: User | null = await this.bot.client.users.fetch(id).catch(() => null);
        if (author === null) return;

        /* Get the user's database instance. */
        let db: DatabaseUser = await this.bot.db.users.fetchUser(author);
        if (db === null) return;

        /* ID of the infraction this message corresponds to, if applicable */
        const infractionID: string | null = original.message.embeds[0].footer?.text ?? null;
        const infraction: DatabaseInfraction | null = db.infractions.find(i => i.id === infractionID) ?? null;

        const reference: DatabaseInfractionReference | undefined = infraction !== null ? {
            type: "infraction", data: infraction.id
        } : undefined;

        /* Warn/ban a user */
        if (action === "warn" || action === "ban") {
            try {
                const row = new ActionRowBuilder<ModalActionRowComponentBuilder>()
                    .addComponents(
                        new TextInputBuilder()
                            .setCustomId("reason")
                            .setLabel("Reason, leave empty for default reason")
                            .setStyle(TextInputStyle.Short)
                            .setRequired(false)
                            .setMaxLength(150)
                    );

                const customID: string = randomUUID();

                const modal = new ModalBuilder()
                    .setCustomId(customID)
                    .setTitle(action === "warn" ? "Send a warning to the user ✉️" : "Ban the user 🔨")
                    .addComponents(row);

                const listener = async (modalInteraction: Interaction) => {
                    if (modalInteraction.isModalSubmit() && !modalInteraction.replied && modalInteraction.customId === customID && modalInteraction.user.id === original.user.id) {
                        await modalInteraction.deferUpdate();
                        
                        /* After using the text input box, remove the event listener for this specific event. */
                        this.bot.client.off("interactionCreate", listener);

                        /* Warning message content */
                        const content: string | undefined = modalInteraction.fields.getTextInputValue("reason").length > 0 ? modalInteraction.fields.getTextInputValue("reason") : undefined;

                        if (action === "warn") {
                            db = await this.warn(db, {
                                by: original.user.id,
                                reason: content, reference
                            });

                        } else if (action === "ban") {
                            db = await this.ban(db, {
                                by: original.user.id, reason: content,
                                reference, status: true
                            });
                        }

                        /* The infraction the user received */
                        const infraction = db.infractions[db.infractions.length - 1]

                        /* Edit the original flag message. */
                        await original.message.edit(new Response()
                            /* Add the original flag embed. */
                            .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                            .addEmbed(this.buildInfractionEmbed(db, infraction, { reference: false })
                                .setAuthor({ name: original.user.username, iconURL: original.user.displayAvatarURL() })
                                .setTitle(action === "warn" ? "Warning given ✉️" : "Banned 🔨")
                                .setColor("Green")
                            )
                        .get() as MessageEditOptions);
                    }
                };

                setTimeout(() => this.bot.client.off("interactionCreate", listener), 60 * 1000);
                this.bot.client.on("interactionCreate", listener);

                await original.showModal(modal);

            } catch (_) {}

        /* Perform a quick moderation action on the user */
        } else if (action === "quick" && original.isStringSelectMenu() && quickAction) {
            /* Which quick action to take */
            const quick: QuickAction = QuickReasons.find(quick => quick.reason === original.values[0])!;

            if (quickAction === "warn") {
                db = await this.warn(db, {
                    by: original.user.id, reason: quick.reason, reference
                });

            } else if (quickAction === "ban") {
                db = await this.ban(db, {
                    by: original.user.id, reason: quick.reason, reference, status: true,
                    duration: quick.duration ? quick.duration.asMilliseconds() : undefined
                });
            }

            /* The infraction the user received */
            const infraction = db.infractions[db.infractions.length - 1];

            /* Edit the original flag message. */
            await original.message.edit(new Response()
                /* Add the original flag embed. */
                .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                .addEmbed(this.buildInfractionEmbed(db, infraction, { reference: false })
                    .setAuthor({ name: original.user.username, iconURL: original.user.displayAvatarURL() })
                    .setTitle(quickAction === "warn" ? "Warning given ✉️" : "Banned 🔨")
                    .setColor("Green")
                )
            .get() as MessageEditOptions);

        /* View information about a user */
        } else if (action === "view") {
            const response: Response = (await this.buildOverview({
                id: author.id, name: author.username, created: author.createdTimestamp, icon: author.displayAvatarURL()
            }, db))
                .setEphemeral(true);

            return response;

        /* Prevent other moderators from taking actions for this flagged message */
        } else if (action === "lock") {
            await original.message.edit(
                new Response()
                    .addEmbed(EmbedBuilder.from(original.message.embeds[0]).setColor("Grey").setFooter({ text: `Locked by ${original.user.username} • ${original.message.embeds[0].footer!.text}` }))
                .get() as MessageEditOptions
            );
        }
    }

    public async buildOverview(target: FindResult, db: DatabaseEntry, additional: boolean = false): Promise<Response> {
        /* Type of the entry */
        const location = this.bot.db.users.location(db);

        /* Formatted meta-data values, for each type */
        let metadataDescription: string = "";
    
        for (const [ key, value ] of Object.entries(db.metadata)) {
            if (!value) continue; metadataDescription = `${metadataDescription}\n${Utils.titleCase(key)} » \`${value}\``;
        }
    
        /* Formatted Premium information */
        let premiumDescription: string = "";
    
        if (db.subscription !== null) premiumDescription = `${premiumDescription}\n**Subscription** » expires *<t:${Math.floor(db.subscription.expires / 1000)}:R>*`;
        if (db.plan !== null) premiumDescription = `${premiumDescription}\n**Plan** » **$${db.plan.total.toFixed(2)}** total; **$${db.plan.used.toFixed(2)}** used; **${db.plan.expenses.length}** expenses; **${db.plan.history.length}** charges`;

        const fields: APIEmbedField[] = [
            { name: "On Discord since <:discord:1097815072602067016>", value: `<t:${Math.floor(target.created / 1000)}:f>` },
            { name: "First interaction 🙌", value: `<t:${Math.floor(Date.parse(db.created) / 1000)}:f>` },
            { name: "Premium ✨", value: premiumDescription.length > 0 ? premiumDescription : "❌" }
        ];

        if (metadataDescription.length > 0) fields.push({ name: "Metadata ⌨️", value: metadataDescription });

        if (location === "users") {
            const user: DatabaseUser = db as DatabaseUser;
            let interactionsDescription: string = "";
        
            for (const [ category, count ] of Object.entries(user.interactions)) {
                interactionsDescription = `${interactionsDescription}\n${Utils.titleCase(category)} » **${count}** times`;
            }

            fields.push(
                { name: "Roles ⚒️", value: [ ...this.bot.db.role.roles(user), "*User*" ].map(role => `**${Utils.titleCase(role)}**`).join(", ") },
                { name: "Voted 📩", value: user.voted ? `<t:${Math.round(Date.parse(user.voted) / 1000)}:R>` : "❌" },
            );

            if (additional) fields.push({ name: "Interactions 🦾", value: interactionsDescription });
        }

        const response = new Response()
            .addEmbed(builder => builder
                .setTitle("Overview 🔎")
                .setAuthor({ name: `${target.name} [${target.id}]`, iconURL: target.icon ?? undefined })
                .setFields(fields.map(f => ({ ...f, inline: true })))
                .setColor(this.bot.branding.color)
            );

        /* Previous automated moderation flags for the user */
        const flags: DatabaseInfraction[] = db.infractions
            .filter(i => i.type === "moderation" && i.moderation && i.reference && typeof i.reference === "object" && i.reference.data)
            .slice(-25);

        if (flags.length > 0) {
            const flagEmbed: EmbedBuilder = new EmbedBuilder()
                .setTitle("Flags 👀").setColor("Orange");

                flagEmbed.addFields(flags.map(f => {
                    const translation = f.moderation!.translation;
                    const content: string = translation ? translation.content : f.reference!.data;

                    const action = f.moderation!.auto ? this.bot.moderation.filter.get(f.moderation!.auto!.action) : null;

                    return {
                        name: `· ${f.moderation!.auto ? action ? action.description : f.moderation!.auto.action : ""} ${FlagToEmoji[f.moderation!.source]}`,
                        value: `\`${Utils.truncate(content, 200)}\`${translation ? `· *translated from \`${translation.detected}\`*` : ""} · <t:${Math.floor(f.when / 1000)}:f>`,
                        inline: true
                    };
                }));

            response.addEmbed(flagEmbed);
        }

        const warnings: DatabaseInfraction[] = db.infractions
            .filter(i => i.type === "warn" && i.reason).slice(-25);

        if (warnings.length > 0) {
            const warningEmbed: EmbedBuilder = new EmbedBuilder()
                .setTitle("Warnings ⚠️").setColor("Yellow");

            warningEmbed.addFields(warnings.map(w => ({
                name: `· ${w.reason!}${!w.by ? " 🤖" : ""}`, inline: true,
                value: `${w.by ? `<@${w.by}> · ` : ""}<t:${Math.floor(w.when / 1000)}:f>`
            })));

            response.addEmbed(warningEmbed);
        }

        const banned = this.banned(db);

        if (banned !== null) response.addEmbed(
            this.buildInfractionEmbed(db, banned, { by: true }).setTitle("Ban ⚒️")
        );
    
        return response;
    }

    /**
     * Build the moderation toolbar.
     * @returns The constructed action row, with the buttons
     */
    private buildToolbar({ user }: DatabaseInfo, result: ModerationResult): ActionRowBuilder[] {
        const buildIdentifier = (type: ModerationToolbarAction | string, args?: string[]) => `mod:${type}:${user.id}${args && args.length > 0 ? `:${args.join(":")}` : ""}`;
        const rows: ActionRowBuilder[] = [];

        /* Whether any action can be taken */
        const punishable: boolean = result.auto ? result.auto.type !== "ban" && result.auto.type !== "warn" : true;
        const action: ModerationFilterActionType | "none" = result.auto?.type ?? "none";

        const initial: ButtonBuilder[] = [
            new ButtonBuilder()
                .setEmoji({ name: "🔎" })
                .setCustomId(buildIdentifier("view"))
                .setStyle(ButtonStyle.Secondary),

            new ButtonBuilder()
                .setEmoji({ name: "✉️" })
                .setDisabled(action === "warn" || action === "ban")
                .setCustomId(buildIdentifier("warn"))
                .setStyle(ButtonStyle.Secondary),
                
            new ButtonBuilder()
                .setEmoji({ name: "🔨" })
                .setDisabled(action === "ban")
                .setCustomId(buildIdentifier("ban"))
                .setStyle(ButtonStyle.Secondary),
            
            new ButtonBuilder()
                .setEmoji({ name: "🔒" })
                .setCustomId(buildIdentifier("lock"))
                .setStyle(ButtonStyle.Danger)
        ];

        /* Create the various moderation rows, if the user is punishable. */
        if (punishable) {
            for (const type of [ "warn", "ban" ]) {
                const components: StringSelectMenuBuilder[] = [
                    new StringSelectMenuBuilder()
                        .setCustomId(buildIdentifier("quick", [ type ]))
        
                        .addOptions(...QuickReasons.filter(quick => quick.type ? quick.type === type : true).filter(quick => quick.duration ? type === "ban" : true).map(quick => ({
                            label: quick.reason, emoji: ActionToEmoji[type],
                            description: quick.duration ? quick.duration.humanize() : undefined,
                            value: quick.reason
                        })))
        
                        .setPlaceholder(`Select a quick ${type === "ban" ? "ban" : "warning"} reason ... ${ActionToEmoji[type]}`)
                ];
        
                rows.push(new ActionRowBuilder().addComponents(components));
            }
        }
        
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(initial));
        return rows;
    }

    /**
     * Send a moderation flag to the logging channel, for moderators to review the flagged message.
     * @param options Moderation send options
     */
    private async send({ result, db, content, notice, user, additional, source, infraction }: ModerationSendOptions): Promise<void> {
        /* Get the moderation channel. */
        const channel = await this.channel("moderation");

        /* Description of the warning embed */
        const description: string = Utils.truncate(result.translation ? `(translated from \`${result.translation.detected}\`)\n*\`\`\`\n${result.translation.content.replaceAll("`", "\\`")}\n\`\`\`*` : `\`\`\`\n${content.replaceAll("`", "\\`")}\n\`\`\``, 4096);

        /* Toolbar component rows */
        const rows = this.buildToolbar(db, result);

        /* Send the moderation message to the channel. */
        const reply = new Response()
            .addEmbed(builder => builder
                .setTitle(`${FlagToName[source]} ${FlagToEmoji[source]}`)
                .setDescription(description)
                .setAuthor({ name: `${user.username} [${user.id}]`, iconURL: user.displayAvatarURL() })
                .setFooter(infraction !== null ? { text: infraction.id } : null)
                .setColor("Yellow")
                .setTimestamp()
            );

        /* Add the toolbar rows to the reply. */
        rows.forEach(row => reply.addComponent(ActionRowBuilder<ButtonBuilder>, row));

        if (notice) reply.embeds[0].addFields({
            name: "Notice 📝", value: `\`${notice}\``, inline: true
        });

        if (result.auto) {
            const action = this.bot.moderation.filter.get(result.auto.action);

            reply.embeds[0].addFields(
                {
                    name: "Filter 🚩",
                    value: `\`${result.auto!.reason ?? action?.description ?? result.auto!.action}\``,
                    inline: true
                },
    
                {
                    name: "Action ⚠️",
                    value: `\`${result.auto!.type}\` ${ActionToEmoji[result.auto!.type]}`,
                    inline: true
                }
            );
        }
        
        if (!result.auto) reply.embeds[0].addFields({
            name: "Blocked ⛔", value: result.blocked ? "✅" : "❌", inline: true
        });

        if (result.source === "image" && additional && additional.model) reply.embeds[0].addFields(
            {
                name: "Model 😊", value: `\`${additional.model.name}\``, inline: true
            }
        );

        await channel.send(reply.get() as MessageCreateOptions);
    }

    public async checkImagePrompt({ user, db, content, model }: ImagePromptModerationOptions): Promise<ModerationResult> {
        let result = await this.check({
            user, db, content, source: "image", additional: { model }
        });
    
        return result;
    }

    /**
     * Check a generation request for flagged content before executing.
     * 
     * If the message contains profanity, ask the user using a Discord button interaction,
     * whether they actually want to execute the request.
     * 
     * @param options Generation options
     * @returns Moderation results
     */
    public async check({ db, content, source, additional, user }: ModerationOptions): Promise<ModerationResult> {
        /* Run the moderation filters on the message. */
        const auto: ModerationFilterActionData | null = await this.filter.filter({
            content, db, source, bot: this.bot
        });

        /* Whether the message should be completely blocked */
        const blocked: boolean = auto !== null && auto.type !== "flag";

        /* Whether the message has been flagged as inappropriate */
        const flagged: boolean = blocked || (auto !== null && auto.type === "flag");

        /* Final moderation result */
        const data: ModerationResult = {
            source, auto: auto ?? undefined,
            flagged, blocked
        };

        /* If the message was flagged or blocked, try to translate the original flagged message into English. */
        if (flagged || blocked) {
            const translation = await translate(content, {
                to: "en"
            }).catch(() => null);

            if (translation !== null && translation.from.language.iso !== "en") data.translation = {
                content: translation.text,
                detected: translation.from.language.iso
            };
        }

        /* The infraction that was given to the user */
        let infraction: DatabaseInfraction = null!;

        /* Add a flag to the user too, for reference. */
        if (flagged) {
            db.user = await this.flag(db.user, {
                flagged: data.flagged, blocked: data.blocked, source: source, translation: data.translation, auto: data.auto
            }, { type: source, data: content });

            infraction = db.user.infractions[db.user.infractions.length - 1];
        }

        /* Apply all moderation infractions, if applicable. */
        if (auto !== null && auto.type !== "flag") {
            const temp = (await this.filter.execute({
                auto, content, db, source, result: data, user, additional, reference: infraction 
            }))!;

            if (temp !== null) infraction = temp;
        }

        /* Send the moderation message to the private channel. */
        if (flagged || blocked) await this.send({
            content, db, user, source, additional, result: data, infraction
        });

        return data;
    }

    public async message(options: ModerationNoticeOptions & Required<Pick<ModerationNoticeOptions, "original">>): Promise<Message | InteractionResponse | null>;
    public async message(options: ModerationNoticeOptions): Promise<Response>;

    public async message({ result, original, name, small }: ModerationNoticeOptions): Promise<Response | Message | InteractionResponse | null> {
        const response = new Response();

        const embed = new EmbedBuilder()
            .setTitle(!small ? "What's this? 🤨" : null)
            .setFooter({ text: `discord.gg/${this.bot.app.config.discord.inviteCode} • Support server` })
            .setColor(result.flagged && !result.blocked ? "Orange" : "Red")
            .setTimestamp();

        if (result.auto && result.auto.type !== "block") {
            if (result.auto.type === "warn") embed.setDescription(`${name} violates our **usage policies** & you have received a **warning**. *If you continue to violate the usage policies, we may have to take additional moderative actions*.`);
            else if (result.auto.type === "ban") embed.setDescription(`${name} violates our **usage policies** & you have been **banned** from using the bot. _If you want to appeal or have questions about your ban, join the **[support server](https://discord.gg/${this.bot.app.config.discord.inviteCode})**_.`);
            else if (result.auto.type === "flag") embed.setDescription(`${name} may violate our **usage policies**. *If you violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.`);
        } else if (result.blocked) embed.setDescription(`${name} violates our **usage policies**. *If you actually violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.`);
        else if (result.flagged) embed.setDescription(`${name} may violate our **usage policies**. *If you violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.`);

        response.addEmbed(embed);

        /* Build a formatted response for the user, if requested. */
        if (original) return await response.send(original);
        else return response;
    }

    public buildInfractionEmbed(entry: DatabaseEntry, infraction: DatabaseInfraction, options: ModerationInfractionOverviewOptions = {}): EmbedBuilder {
        const { by, reference }: Required<ModerationInfractionOverviewOptions> = {
            by: false, reference: true,
            ...options
        };

        const embed: EmbedBuilder = new EmbedBuilder()
            .setColor("Red").setTimestamp(infraction.when);

        const until: number | null = infraction.until ? Math.floor(infraction.until / 1000) : null;
        const fields: APIEmbedField[] = [];

        if (infraction.reason) fields.push({
            name: "Reason", value: infraction.reason, inline: true
        });

        if (by && infraction.by) fields.push({
            name: "By", value: `<@${infraction.by}>`, inline: true
        });

        if (until) fields.push({
            name: "Until", value: `<t:${until}:f>, <t:${until}:R>`, inline: true
        });

        if (reference && infraction.reference && infraction.reference.type === "infraction") {
            /* Find the corresponding infraction. */
            const flag: DatabaseInfraction | null = entry.infractions.find(i => i.id === infraction.reference!.data && i.reference) ?? null;

            if (flag !== null) fields.push({
                name: "Reference", inline: true,
                value: `**${FlagToName[flag.reference!.type]}** » \`${flag.reference!.data}\``
            });
        }

        return embed.setFields(fields);
    }

    public buildBanResponse(entry: DatabaseEntry, infraction: DatabaseInfraction): Response {
        const until: number | null = infraction.until ? Math.floor(infraction.until / 1000) : null;
        const builder = this.buildInfractionEmbed(entry, infraction);
        const location = this.bot.db.users.location(entry);

        return new Response()
            .addEmbed(builder
                .setTitle(`${location === "guilds" ? "This server is" : "You are"} banned **${until !== null ? "temporarily" : "permanently"}** from using the bot 😔`)
                .setDescription(`_If you want to appeal or have questions about ${location === "guilds" ? "the server's" : "your"} ban, join the **[support server](https://discord.gg/${this.bot.app.config.discord.inviteCode})**_.`)
            )
            .setEphemeral(true);
    }

    public async warningModal<T extends DatabaseEntry = DatabaseEntry>({ interaction, db }: ModerationWarningModalOptions<T>): Promise<T> {
        /* The user's unread infractions, if any */
        const unread: DatabaseInfraction[] = this.unread(db);

        /* The original author of the interaction/message */
        const author: User = interaction instanceof Message ? interaction.author : interaction.user;

		if (unread.length > 0) {
            /* ID of the button to acknowledge the infractions */
            const buttonID: string = randomUUID();

			const row = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setCustomId(buttonID)
						.setLabel("Acknowledge")
						.setStyle(ButtonStyle.Danger),

					new ButtonBuilder()
						.setURL(Utils.supportInvite(this.bot))
						.setLabel("Support server")
						.setStyle(ButtonStyle.Link)
				);

            const fields: APIEmbedField[] = [];

            for (const warning of unread) {
                if (warning.reference && warning.reference.type === "infraction") {
                    const flag: DatabaseInfraction | null = db.infractions.find(i => i.id === warning.reference!.data && i.reference) ?? null;
        
                    fields.push({
						name: `${warning.reason} ⚠️`,
						value: flag !== null ? `**${FlagToName[flag.reference!.type]}** » \`${Utils.truncate(flag.reference!.data, 128)}\` @ <t:${Math.floor(flag.when / 1000)}:f>` : `*<t:${Math.floor(warning.when / 1000)}:F>*`
					});
                }
            }

			const reply = (await new Response()
				.addComponent(ActionRowBuilder<ButtonBuilder>, row)
				.addEmbed(builder => builder
					.setTitle("Before you continue ...")
					.setDescription(`You received **${unread.length > 1 ? "several warnings" : "a warning"}**, as a consequence of your messages with the bot. *${unread.length > 1 ? "These are only warnings" : "This is only a warning"}; you can continue to use the bot. If you however keep violating our **usage policies**, we may have to take further moderative actions*.`)
					.setFields(fields)
					.setFooter({ text: `If you have any further questions about ${unread.length > 1 ? "these warnings" : "this warning"}, join our support server.` })
					.setColor("Red")
				)
                .setEphemeral(true)
            .send(interaction));
                
            if (reply === null) return db;

			/* Wait for the `Acknowledge` button to be pressed, or for the collector to expire. */
			const collector = reply.createMessageComponentCollector<ComponentType.Button>({
				componentType: ComponentType.Button,
				filter: i => i.user.id === author.id && i.customId === buttonID,
				time: 60 * 1000, max: 1
			});

			/* When the collector is done, delete the reply message & continue the execution. */
			await new Promise<void>(resolve => collector.on("end", async collected => {
				await Promise.all(collected.map(entry => entry.deferUpdate())).catch(() => {});
				resolve();
			}));

            /* If the reply was to a message, delete the warning modal. */
            if (interaction instanceof Message) await reply.delete();

			/* Mark the unread infractions as read. */
			return await this.read(db, unread);

		} else {
            return db;
        }
    }

    /**
     * Get the specified logging channel.
     * 
     * @throws An error, if the channel could not be found
     * @returns The logging channel
    */
    public async channel(type: keyof Config["channels"]): Promise<TextChannel> {
        const {
            guild: guildID, channel: channelID
        } = this.bot.app.config.channels[type];
    
        const guild: Guild = this.bot.client.guilds.cache.get(guildID) ?? await this.bot.client.guilds.fetch(guildID);
        const channel: Channel | null = this.bot.client.channels.cache.get(channelID) ?? await guild.channels.fetch(channelID);
    
        if (channel === null) throw new Error("Invalid message channel has been given");
        if (!channel.isTextBased()) throw new Error("Message channel is not a text channel");
    
        return channel as TextChannel;
    }

    /**
     * Check whether the specified user or guild is banned.
     * @param entry User or guild to check
     * 
     * @returns Whether they are banned
     */
    public banned<T extends DatabaseEntry = DatabaseEntry>(entry: T): DatabaseInfraction | null {
        /* List of all ban-related infractions */
        const infractions: DatabaseInfraction[] = entry.infractions.filter(
            i => (i.type === "ban" || i.type === "unban") && (i.until ? Date.now() < i.until : true)
        );

        if (infractions.length === 0) return null;

        /* Whether the entry is banned; really dumb way of checking it */
        const odd: boolean = infractions.length % 2 > 0;
        if (!odd) return null;

        /* The entry's `ban` infraction */
        const infraction: DatabaseInfraction = infractions[infractions.length - 1];
        if (infraction.until && Date.now() >= infraction.until) return null;

        return infraction;
    }

    public async flag<T extends DatabaseEntry = DatabaseEntry>(entry: T, data: ModerationResult, reference: DatabaseInfractionReference): Promise<T> {
        return this.infraction(entry, { type: "moderation", moderation: data, reference });
    }

    public async warn<T extends DatabaseEntry = DatabaseEntry>(entry: T, { by, reason, reference }: Pick<DatabaseInfractionOptions, "reason" | "by" | "reference">): Promise<T> {
        return this.infraction(entry, { by, reason: reason ?? "Inappropriate use of the bot", type: "warn", seen: false, reference });
    }

    public async ban<T extends DatabaseEntry = DatabaseEntry>(entry: T, { by, reason, status, duration, reference }: Pick<DatabaseInfractionOptions, "reason" | "by" | "reference"> & { status: boolean, duration?: number }): Promise<T> {
        const banned: boolean = this.banned(entry) !== null;
        if (banned === status) return entry;

        return this.infraction(entry, {
            type: status ? "ban" : "unban", by, reference,
            reason: reason ?? "Inappropriate use of the bot",
            until: duration ? Date.now() + duration : undefined
        });
    }

    /**
     * Mark the specified infractions as seen for the entry.
     * 
     * @param entry Entry to mark the infractions as seen for
     * @param marked Infractions to mark as seen
     */
    public async read<T extends DatabaseEntry = DatabaseEntry>(entry: T, marked: DatabaseInfraction[]): Promise<T> {
        let arr: DatabaseInfraction[] = entry.infractions;

        /* Loop through the entry's infractions, and when the infractions that should be marked as read were found, change their `seen` status. */
        arr = arr.map(
            i => marked.find(m => m.id === i.id) !== undefined ? { ...i, seen: true } : i
        );

        return await this.bot.db.queue.update("users", entry, { infractions: arr });
    }

    /**
     * Get a list of unread infractions for the entry.
     * @param entry Entry to get unread infractions of
     * @returns 
     */
    public unread<T extends DatabaseEntry = DatabaseEntry>(entry: T): DatabaseInfraction[] {
        return entry.infractions.filter(i => i.type === "warn" && i.seen === false);
    }

    /**
     * Give an infraction of the specified type to a entry.
     * 
     * @param entry Entry to give the infraction to
     * @param options Infraction options
     */
    public async infraction<T extends DatabaseEntry = DatabaseEntry>(entry: T, { by, reason, type, seen, moderation, until, reference }: DatabaseInfractionOptions): Promise<T> {
        /* Raw infraction data */
        const data: DatabaseInfraction = {
            by, reason, type, moderation,
            when: Date.now(), id: randomUUID().slice(undefined, 8)
        };

        if (type === "warn") data.seen = seen ?? false;
        if (reference) data.reference = reference;
        if (until) data.until = until;

        return this.bot.db.queue.update(this.bot.db.users.location(entry), entry, {
            infractions: [
                ...entry.infractions, data
            ]
        });
    }

    public async removeInfraction<T extends DatabaseEntry = DatabaseEntry>(entry: T, which: DatabaseInfraction | string): Promise<T> {
        /* ID of the infraction to remove */
        const id: string = typeof which === "object" ? which.id : which;

        /* Filter out the infraction to remove from the entry's list of infractions. */
        const infractions: DatabaseInfraction[] = entry.infractions.filter(i => i.id !== id);

        return this.bot.db.queue.update(this.bot.db.users.location(entry), entry, {
            infractions
        });
    }
}