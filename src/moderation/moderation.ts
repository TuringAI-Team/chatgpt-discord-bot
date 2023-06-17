import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, MessageEditOptions, ModalActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, User, StringSelectMenuBuilder, StringSelectMenuInteraction, Collection, Snowflake, TextChannel, Guild, Channel, Message, InteractionResponse, MessageCreateOptions, ChatInputCommandInteraction, ComponentType } from "discord.js";
import translate from "@iamtraction/google-translate";
import { randomUUID } from "crypto";

import { AutoModerationActionData, AutoModerationActionType, AutoModerationManager } from "./automod/automod.js";
import { InteractionHandlerClassType, InteractionHandlerResponse } from "../interaction/handler.js";
import { ModerationInteractionHandlerData } from "../interactions/moderation.js";
import { DatabaseUser, DatabaseUserInfraction } from "../db/schemas/user.js";
import { Response, ResponseSendClass } from "../command/response.js";
import { AutoModerationFilter } from "./automod/filters.js";
import { DatabaseGuild } from "../db/schemas/guild.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { FindResult, Utils } from "../util/utils.js";
import { Config } from "../config.js";
import { Bot } from "../bot/bot.js";

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
    translationPrompt: "Translation prompt",
    translationResult: "Translation result",
    youTubeQuery: "YouTube search query",
    chatUser: "User message"
}

const QuickReasons: string[] = [
    "Inappropriate use of the bot",
    "This is your only warning",
    "This is your last warning",
    "If you need help, talk to someone that cares for you",
    "Joking about self-harm/suicide",
    "Self-harm/suicide-related content",
    "Sexual content",
    "Sexual content involving minors",
    "Gore/violent content",
    "Racist content",
    "Trolling",
    "Spam",
    "Tricking bot into generating inappropriate content",
    "Using bot to generate inappropriate content"
]

export type ModerationToolbarAction = "ban" | "warn" | "view" | "quick" | "lock"

type ModerationSendOptions = ModerationOptions & {
    result: ModerationResult;
    content: string;
    notice?: string;
}

type ModerationImageSendOptions = Pick<ModerationSendOptions, "result" | "db" | "content" | "notice" | "user">
export type ModerationSource = "chatUser" | "chatBot" | "image" | "translationPrompt" | "translationResult" | "describe" | "video" | "youTubeQuery"

interface AdditionalModerationOptions {
    /* Which Stable Diffusion model was used */
    model?: string;

    /* Whether NSFW content is allowed */
    nsfw: boolean;
}

export interface ModerationOptions {
    user: User;

    source: ModerationSource;
    db: DatabaseInfo;
    content: string;

    /* Other data */
    filter?: (action: AutoModerationFilter) => boolean;
    additional?: AdditionalModerationOptions;
}

export interface ModerationNoticeOptions {
    result: ModerationResult;
    original?: ResponseSendClass;
    name: string;
}

export interface ModerationWarningModalOptions {
    interaction: Message | ChatInputCommandInteraction | InteractionHandlerClassType;
    db: DatabaseInfo;
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
    auto?: AutoModerationActionData;

    /* Source of the moderation request */
    source: ModerationSource;
}

export type DatabaseModerationResult = ModerationResult & { reference: string }
export type SerializedModerationResult = ModerationResult

export class ModerationManager {
    private readonly bot: Bot;

    /* AutoMod manager */
    public readonly automod: AutoModerationManager;

    constructor(bot: Bot) {
        this.bot = bot;

        /* Initialize all other sub-managers. */
        this.automod = new AutoModerationManager(this.bot);
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

                const modal = new ModalBuilder()
                    .setCustomId(`${action}-modal:${original.id}`)
                    .setTitle(action === "warn" ? "Send a warning to the user ✉️" : "Ban the user 🔨")
                    .addComponents(row);

                const listener = async (modalInteraction: Interaction) => {
                    if (modalInteraction.isModalSubmit() && !modalInteraction.replied && modalInteraction.customId === `${action}-modal:${original.id}` && modalInteraction.user.id === original.user.id) {
                        await modalInteraction.deferUpdate();
                        
                        /* After using the text input box, remove the event listener for this specific event. */
                        this.bot.client.off("interactionCreate", listener);

                        /* Warning message content */
                        const content: string | undefined = modalInteraction.fields.getTextInputValue("reason").length > 0 ? modalInteraction.fields.getTextInputValue("reason") : undefined;

                        if (action === "warn") {
                            /* Send the warning to the user. */
                            await this.bot.db.users.warn(db, {
                                by: original.user.id,
                                reason: content
                            });

                        } else if (action === "ban") {
                            /* Ban the user. */
                            await this.bot.db.users.ban(db, {
                                by: original.user.id,
                                reason: content,
                                status: true
                            });
                        }

                        /* Fetch the user's infractions again. */
                        db = await this.bot.db.users.fetchUser(author);
                        const infractions: DatabaseUserInfraction[] = db.infractions;

                        /* Edit the original flag message. */
                        await original.message.edit(new Response()
                            /* Add the original flag embed. */
                            .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                            .addEmbed(builder => builder
                                .setAuthor({ name: original.user.username, iconURL: original.user.displayAvatarURL() })
                                .setTitle(action === "warn" ? "Warning given ✉️" : "Banned 🔨")
                                .setDescription(`\`\`\`\n${infractions[infractions.length - 1].reason}\n\`\`\``)
                                .setColor("Green")
                                .setTimestamp()
                            )
                        .get() as MessageEditOptions);
                    }
                };

                setTimeout(() => this.bot.client.off("interactionCreate", listener), 60 * 1000);
                this.bot.client.on("interactionCreate", listener);

                await original.showModal(modal);

            } catch (_) {}

        /* Perform a quick moderation action on the user */
        } else if (action === "quick" && original.isStringSelectMenu()) {
            /* Action to perform & specified reason */
            const action: "ban" | "warn" = quickAction!;
            const reason: string = original.values[0];

            if (action === "warn") {
                await this.bot.db.users.warn(db, {
                    by: original.user.id, reason
                });

            } else if (action === "ban") {
                await this.bot.db.users.ban(db, {
                    by: original.user.id, reason, status: true
                });
            }

            /* Edit the original flag message. */
            await original.message.edit(new Response()
                .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                .addEmbed(builder => builder
                    .setAuthor({ name: original.user.username, iconURL: original.user.displayAvatarURL() })
                    .setTitle(action === "warn" ? "Warning given ✉️" : "Banned 🔨")
                    .setDescription(`\`\`\`\n${reason}\n\`\`\``)
                    .setColor("Green")
                    .setTimestamp()
                )
            .get() as MessageEditOptions);

        /* View information about a user */
        } else if (action === "view") {
            const response: Response = (await this.buildUserOverview({
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
    public async buildUserOverview(target: FindResult, db: DatabaseUser): Promise<Response> {
        /* Overview of the users' infractions in the description */
        const infractions: DatabaseUserInfraction[] = db.infractions.filter(i => i.type !== "moderation");
        let description: string | null = null;
    
        /* List of moderators for the infractions */
        const moderators: Collection<Snowflake, User> = new Collection();
    
        for (const infraction of infractions) {
            if (!infraction.by || moderators.has(infraction.by)) continue;
    
            /* Fetch the moderator, who took this action. */
            const user: User = await this.bot.client.users.fetch(infraction.by);
            moderators.set(user.id, user);
        }
    
        if (infractions.length > 0) description = infractions
            .map(i => `${ActionToEmoji[i.type]} \`${i.type}\`${i.by ? ` by **${moderators.get(i.by)!.username}**` : ""} @ <t:${Math.round(i.when / 1000)}:f>${i.seen !== undefined ? i.seen ? " ✅" : " ❌" : ""}${i.reason ? ` » *\`${i.reason}\`*` : ""}${i.automatic ? " 🤖" : " 👤"}`)
            .join("\n");
    
        if (infractions.length > 0) description = `__**${infractions.length}** infractions__\n\n${description}`;
    
        /* Previous automated moderation flags for the user */
        const flags: DatabaseUserInfraction[] = db.infractions.filter(i => i.type === "moderation" && i.moderation);
        const shown: DatabaseUserInfraction[] = flags.slice(-5);
        
        /* Format the description for previous automated moderation flags. */
        let flagDescription: string | null = null;
        if (flags.length > 0) flagDescription = `${flags.length - shown.length !== 0 ? `(*${flags.length - shown.length} previous flags ...*)\n\n` : ""}${shown.map(f => {
            const content: string = f.moderation!.translation ? f.moderation!.translation.content : f.moderation!.reference;
            const translation: boolean = f.moderation!.translation != undefined;

            return `<t:${Math.round(f.when / 1000)}:f> » ${f.moderation!.auto ? `\`${f.moderation!.auto.action}\` ` : ""}${FlagToEmoji[f.moderation!.source]} » ${translation ? "*" : ""}\`${content.split("\n").length > 1 ? `${content.split("\n")[0]} ...` : content}\`${translation ? "*" : ""}`;
        }).join("\n")}`
    
        /* Formatted interactions count, for each category */
        let interactionsDescription: string = "";
    
        for (const [ category, count ] of Object.entries(db.interactions)) {
            interactionsDescription = `${interactionsDescription}\n${Utils.titleCase(category)} » **${count}** times`;
        }
    
        /* Formatted meta-data values, for each type */
        let metadataDescription: string = "";
    
        for (const [ key, value ] of Object.entries(db.metadata)) {
            if (!value) continue;
            metadataDescription = `${metadataDescription}\n${Utils.titleCase(key)} » \`${value}\``;
        }
    
        /* Formatted Premium information */
        let premiumDescription: string = "";
    
        if (db.subscription !== null) premiumDescription = `${premiumDescription}\n**Subscription** » expires *<t:${Math.floor(db.subscription.expires / 1000)}:R>*`;
        if (db.plan !== null) premiumDescription = `${premiumDescription}\n**Plan** » **$${db.plan.total.toFixed(2)}** total; **$${db.plan.used.toFixed(2)}** used; **${db.plan.expenses.length}** expenses; **${db.plan.history.length}** charges`;
    
        /* Whether the user is banned */
        const banned = await this.bot.db.users.banned(db);

        const response = new Response()
            .addEmbed(builder => builder
                .setTitle("User Overview 🔎")
                .setAuthor({ name: `${target.name} [${target.id}]`, iconURL: target.icon ?? undefined })
                .setDescription(description)
                .setFields(
                    {
                        name: "Discord member since <:discord:1097815072602067016>",
                        value: `<t:${Math.floor(target.created / 1000)}:f>`,
                        inline: true
                    },
    
                    {
                        name: "First interaction 🙌",
                        value: `<t:${Math.floor(Date.parse(db.created) / 1000)}:f>`,
                        inline: true
                    },
    
                    {
                        name: "Interactions 🦾",
                        value: interactionsDescription,
                        inline: true
                    },
    
                    {
                        name: "Metadata ⌨️",
                        value: metadataDescription.length > 0 ? metadataDescription : "*(none)*",
                        inline: true
                    },
    
                    {
                        name: "Premium ✨",
                        value: premiumDescription.length > 0 ? premiumDescription : "❌",
                        inline: true
                    },
    
                    {
                        name: "Roles ⚒️",
                        value: [ ... this.bot.db.role.roles(db), "*User*" ].map(role => `**${Utils.titleCase(role)}**`).join(", "),
                        inline: true
                    },
    
                    {
                        name: "Voted 📩",
                        value: db.voted ? `<t:${Math.round(Date.parse(db.voted) / 1000)}:R>` : "❌",
                        inline: true
                    },
    
                    {
                        name: "Banned ⚠️",
                        value: banned !== null ? "✅" : "❌",
                        inline: true
                    }
                )
                .setColor(this.bot.branding.color)
            );
    
        if (flagDescription !== null) response.addEmbed(builder => builder
            .setDescription(Utils.truncate(flagDescription!, 2000))
            .setColor("Purple")
        );
    
        return response;
    }
    
    public async buildGuildOverview(target: FindResult, db: DatabaseGuild): Promise<Response> {
        /* Formatted Premium information */
        let premiumDescription: string = "";
    
        if (db.subscription !== null) premiumDescription = `${premiumDescription}\n**Subscription** » expires *<t:${Math.floor(db.subscription.expires / 1000)}:R>*`;
        if (db.plan !== null) premiumDescription = `${premiumDescription}\n**Plan** » **$${db.plan.total.toFixed(2)}** total; **$${db.plan.used.toFixed(2)}** used; **${db.plan.expenses.length}** expenses; **${db.plan.history.length}** charges`;
    
        const response = new Response()
            .addEmbed(builder => builder
                .setTitle("Guild Overview 🔎")
                .setAuthor({ name: `${target.name} [${target.id}]`, iconURL: target.icon ?? undefined })
                .setFields(
                    {
                        name: "Created on <:discord:1097815072602067016>",
                        value: `<t:${Math.floor(target.created / 1000)}:f>`,
                        inline: true
                    },
    
                    {
                        name: "First interaction 🙌",
                        value: `<t:${Math.floor(Date.parse(db.created) / 1000)}:f>`,
                        inline: true
                    },
    
                    {
                        name: "Premium ✨",
                        value: premiumDescription.length > 0 ? premiumDescription : "❌",
                        inline: true
                    }
                )
                .setColor(this.bot.branding.color)
            );
    
        return response;
    }

    public buildBanMessage(infraction: DatabaseUserInfraction): Response {
        return new Response()
            .addEmbed(builder => builder
                .setTitle(`You were banned **permanently** from the bot 😔`)
                .setDescription("_If you want to appeal or have questions about your ban, join the **[support server](https://discord.gg/${this.bot.app.config.discord.inviteCode})**_.")
                .addFields({
                    name: "Reason", value: infraction.reason ?? "Inappropriate use of the bot"
                })
                .setTimestamp(infraction.when)
                .setColor("Red")
            )
            .setEphemeral(true);
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
        const action: AutoModerationActionType | "none" = result.auto?.type ?? "none";

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
            for (const name of [ "warn", "ban" ]) {
                const components: StringSelectMenuBuilder[] = [
                    new StringSelectMenuBuilder()
                        .setCustomId(buildIdentifier("quick", [ name ]))
        
                        .addOptions(...QuickReasons.map(reason => ({
                            label: `${reason} ${ActionToEmoji[name]}`,
                            value: reason
                        })))
        
                        .setPlaceholder(`Select a quick ${name === "ban" ? "ban" : "warning"} reason ... ${ActionToEmoji[name]}`)
                ];
        
                rows.push(new ActionRowBuilder().addComponents(components));
            }
        }
        
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(initial));
        return rows;
    }

    public async sendImageModerationMessage(options: ModerationImageSendOptions): Promise<void> {
        return this.send({
            ...options, source: "image"
        });
    }

    /**
     * Send a moderation flag to the logging channel, for moderators to review the flagged message.
     * @param options Moderation send options
     */
    private async send({ result, db, content, notice, user, additional, source }: ModerationSendOptions): Promise<void> {
        /* Get the moderation channel. */
        const channel = await this.channel("moderation");

        /* Description of the warning embed */
        const description: string = Utils.truncate(result.translation ? `(Translated from \`${result.translation.detected}\`)\n*\`\`\`\n${result.translation.content}\n\`\`\`*` : `\`\`\`\n${content}\n\`\`\``, 4096);

        /* Toolbar component rows */
        const rows = this.buildToolbar(db, result);

        /* Send the moderation message to the channel. */
        const reply = new Response()
            .addEmbed(builder => builder
                .setTitle(`${FlagToName[source]} ${FlagToEmoji[source]}`)
                .addFields(
                    {
                        name: "Infractions ⚠️",
                        value: "`" + db.user.infractions.filter(i => i.type === "warn").length + "`",
                        inline: true
                    }
                )
                .setDescription(description)
                .setAuthor({ name: `${user.username} [${user.id}]`, iconURL: user.displayAvatarURL() })
                .setFooter({ text: `Cluster #${this.bot.data.id + 1}` })
                .setColor("Yellow")
                .setTimestamp()
            );

        /* Add the toolbar rows to the reply. */
        rows.forEach(row => reply.addComponent(ActionRowBuilder<ButtonBuilder>, row));

        if (notice) reply.embeds[0].addFields({
            name: "Notice 📝",
            value: `\`${notice}\``,
            inline: true
        });

        if (result.auto) reply.embeds[0].addFields(
            {
                name: "Filter 🚩",
                value: `\`${result.auto!.reason ?? result.auto!.action}\``,
                inline: true
            },

            {
                name: "Action ⚠️",
                value: `\`${result.auto!.type}\` ${ActionToEmoji[result.auto!.type]}`,
                inline: true
            }
        );
        
        if (!result.auto) reply.embeds[0].addFields({
            name: "Blocked ⛔",
            value: result.blocked ? "✅" : "❌",
            inline: true
        });

        if (result.source === "image" && additional && additional.model) reply.embeds[0].addFields(
            {
                name: "Model 😊",
                value: `\`${additional.model}\``,
                inline: true
            },

            {
                name: "NSFW 🔞",
                value: additional.nsfw ? "✅" : "❌",
                inline: true
            }
        );

        await channel.send(reply.get() as MessageCreateOptions);
    }

    public async checkImagePrompt({ user, db, content, nsfw, model }: ImagePromptModerationOptions): Promise<ModerationResult> {
        let result = await this.check({
            user, db, content, source: "image",
    
            /* Check for all possible filters *except* for NSFW filters, to give people some freedom with their prompts. */ 
            filter: nsfw ? action => {
                if (action.description === "Block sexual words") return true;
                return false;
            } : undefined,
    
            additional: { model, nsfw }
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
    public async check({ db, content, source, filter, additional, user }: ModerationOptions): Promise<ModerationResult> {
        /* Run the AutoMod filter on the message. */
        const auto: AutoModerationActionData | null = await this.automod.execute({
            content, db, source, bot: this.bot,
            filterCallback: filter ? (_, action) => filter(action) : undefined
        });

        /* If this moderation request is related to image generation, run the Turing API filter too. */
        const turing = (source === "image" || source === "video") && additional
            ? await this.bot.turing.filter(content, additional.model).catch(() => null)
            : null;

        /* Whether the message should be completely blocked */
        let blocked: boolean = auto !== null && auto.type !== "flag";

        /* Whether the message has been flagged as inappropriate */
        let flagged: boolean = blocked || auto !== null && auto.type === "flag";

        /* If the Turing filter was used, do the additional checks. */
        if (additional && turing) {
            if (turing.isNsfw && !additional.nsfw) flagged = true;
        
            if (turing.isCP) {
                blocked = true;
                flagged = true;
            }
        }

        /* Final moderation result */
        const data: ModerationResult = {
            source,
            auto: auto ?? undefined,

            flagged: flagged,
            blocked: blocked
        };

        /* If the message was flagged or blocked, try to translate the original flagged message into English. */
        if (flagged || blocked) {
            const translation = await translate(content, {
                to: "en"
            }).catch(() => null);

            /* Add the translation result. */
            if (translation !== null && translation.from.language.iso !== "en") data.translation = {
                content: translation.text,
                detected: translation.from.language.iso
            }
        }

        /* Send the moderation message to the private channel. */
        if (flagged || blocked) await this.send({
            content, db, user, source, additional, filter, result: data
        });

        /* Add a flag to the user too, for reference. */
        if (flagged) await this.bot.db.users.flag(db.user, {
            flagged: data.flagged, blocked: data.blocked, source: source, reference: content, translation: data.translation, auto: data.auto
        });

        /* If the moderation filter requested it, ban the user. */
        if (auto !== null && auto.type === "ban") {
            await this.bot.db.users.ban(db.user, { status: true, automatic: true, reason: auto.reason });

        /* If the moderation filter requested it, give a warning to the user. */
        } else if (auto !== null && auto.type === "warn") {
            await this.bot.db.users.warn(db.user, { automatic: true, reason: auto.reason });
        }

        return data;
    }

    public async message(options: ModerationNoticeOptions & Required<Pick<ModerationNoticeOptions, "original">>): Promise<Message | InteractionResponse | null>;
    public async message(options: ModerationNoticeOptions): Promise<Response>;

    public async message({ result, original, name }: ModerationNoticeOptions): Promise<Response | Message | InteractionResponse | null> {
        const response = new Response();

        const embed = new EmbedBuilder()
            .setTitle("What's this? 🤨")
            .setFooter({ text: `discord.gg/${this.bot.app.config.discord.inviteCode} • Support server` })
            .setColor("Red")
            .setTimestamp();

        if (result.auto && result.auto.type !== "block") {
            if (result.auto.type === "warn") embed.setDescription(`${name} violates our **usage policies** & you have received a **warning**. *If you continue to violate the usage policies, we may have to take additional moderative actions*.`);
            else if (result.auto.type === "ban") embed.setDescription(`${name} violates our **usage policies** & you have been **banned** from using the bot. _If you want to appeal or have questions about your ban, join the **[support server](https://discord.gg/${this.bot.app.config.discord.inviteCode})**_.`);
        } else if (result.blocked) embed.setDescription(`${name} violates our **usage policies**. *If you violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.`);

        response.addEmbed(embed);

        /* Build a formatted response for the user, if requested. */
        if (original) return await response.send(original);
        else return response;
    }

    public async warningModal({ interaction, db }: ModerationWarningModalOptions): Promise<DatabaseUser> {
        /* The user's unread infractions, if any */
        const unread: DatabaseUserInfraction[] = this.bot.db.users.unread(db.user);

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

			const reply = (await new Response()
				.addComponent(ActionRowBuilder<ButtonBuilder>, row)
				.addEmbed(builder => builder
					.setTitle(`Before you continue ...`)
					.setDescription(`You received **${unread.length > 1 ? "several warnings" : "a warning"}**, as a consequence of your messages with the bot. *${unread.length > 1 ? "These are only warnings" : "This is only a warning"}; you can continue to use the bot. If you however keep violating our **usage policies**, we may have to take further moderative actions*.`)
					
					.addFields(unread.map(i => ({
						name: `${i.reason} ⚠️`,
						value: `*<t:${Math.floor(i.when / 1000)}:F>*`
					})))

					.setFooter({ text: "If you have any further questions about these warnings, join our support server." })
					.setColor("Red")
				)
                .setEphemeral(true)
            .send(interaction));
                
            if (reply === null) return db.user;

			/* Wait for the `Acknowledge` button to be pressed, or for the collector to expire. */
			const collector = reply.createMessageComponentCollector<ComponentType.Button>({
				componentType: ComponentType.Button,
				filter: i => i.user.id === author.id && i.customId === buttonID,
				time: 60 * 1000,
				max: 1
			});

			/* When the collector is done, delete the reply message & continue the execution. */
			await new Promise<void>(resolve => collector.on("end", async collected => {
				await Promise.all(collected.map(entry => entry.deferUpdate()))
					.catch(() => {});

				resolve();
			}));

            /* If the reply was to a message, delete the warning modal. */
            if (interaction instanceof Message) await reply.delete();

			/* Mark the unread infractions as read. */
			return await this.bot.db.users.read(db.user, unread);

		} else {
            return db.user;
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
}