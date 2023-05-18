import { ComponentType, ActionRowBuilder, ButtonBuilder, APIButtonComponentWithCustomId, ButtonInteraction, ButtonStyle, EmbedBuilder, Interaction, InteractionReplyOptions, Message, MessageEditOptions, ModalActionRowComponentBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, User, StringSelectMenuBuilder, StringSelectMenuInteraction, Collection, Snowflake } from "discord.js";
import dayjs from "dayjs";

import { DatabaseUser, DatabaseUserInfraction, DatabaseUserInfractionType, DatabaseInfo } from "../../db/managers/user.js";
import { ModerationOptions, ModerationResult } from "../../conversation/moderation/moderation.js";
import { AutoModerationActionType } from "../../conversation/moderation/automod/automod.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { Conversation } from "../../conversation/conversation.js";
import { OpenAIChatMessage } from "../../openai/types/chat.js";
import { Response } from "../../command/response.js";
import { messageChannel } from "./channel.js";
import { Bot } from "../../bot/bot.js";
import { FindResult, Utils } from "../utils.js";

const ActionToEmoji: { [ Key in DatabaseUserInfractionType as string ]: string; } = {
	"warn": "⚠️",
	"ban": "🔨",
	"unban": "🙌",
	"moderation": "🤨",
    "block": "⛔",
    "flag": "🚩"
}

const FlagToEmoji: Record<ModerationSource, string> = {
    bot: "🤖",
    describe: "🔎",
    image: "🖼️",
    video: "📸",
    translationPrompt: "🌐",
    translationResult: "🌐",
    youTubeQuery: "▶️",
    user: "👤"
}

const FlagToName: Record<ModerationSource, string> = {
    bot: "Bot response",
    describe: "Image description",
    image: "Image prompt",
    video: "Video prompt",
    translationPrompt: "Translation prompt",
    translationResult: "Translation result",
    youTubeQuery: "YouTube search query",
    user: "User message"
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

type ModerationToolbarAction = "ban" | "warn" | "view" | "ai" | "quick" | "lock"

interface ModerationSendOptions {
    result: ModerationResult;
    conversation: Conversation;
    db: DatabaseInfo;
    content: string;
    type: ModerationSource;
    options: ModerationOptions;
    notice?: string;
}

type ModerationImageSendOptions = Pick<ModerationSendOptions, "result" | "conversation" | "db" | "content" | "notice">
export type ModerationSource = "user" | "bot" | "image" | "translationPrompt" | "translationResult" | "describe" | "video" | "youTubeQuery"

/**
 * Handle an interaction, in the moderation channel.
 * @param original Interaction to handle
 */
export const handleModerationInteraction = async (bot: Bot, original: ButtonInteraction | StringSelectMenuInteraction): Promise<void> => {
    if (original.channelId !== bot.app.config.channels.moderation.channel) return;

    /* Data of the moderation interaction */
    const data = original.customId.split(":");

    /* Type of moderation action */
    const type: ModerationToolbarAction = data.shift()! as ModerationToolbarAction;

    /* Fetch the original author. */
    const author: User | null = await bot.client.users.fetch(data.shift()!).catch(() => null);
    if (author === null) return;

    /* Get the user's database instance. */
    let db: DatabaseUser = await bot.db.users.fetchUser(author);
    if (db === null) return;

    /* Warn/ban a user */
    if (type === "warn" || type === "ban") {
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
                .setCustomId(`${type}-modal:${original.id}`)
                .setTitle(type === "warn" ? "Send a warning to the user ✉️" : "Ban the user 🔨")
                .addComponents(row);

            const listener = async (modalInteraction: Interaction) => {
                if (modalInteraction.isModalSubmit() && !modalInteraction.replied && modalInteraction.customId === `${type}-modal:${original.id}` && modalInteraction.user.id === original.user.id) {
                    await modalInteraction.deferUpdate();
                    
                    /* After using the text input box, remove the event listener for this specific event. */
                    bot.client.off("interactionCreate", listener);

                    /* Warning message content */
                    const content: string | undefined = modalInteraction.fields.getTextInputValue("reason").length > 0 ? modalInteraction.fields.getTextInputValue("reason") : undefined;

                    if (type === "warn") {
                        /* Send the warning to the user. */
                        await bot.db.users.warn(db, {
                            by: original.user.id,
                            reason: content
                        });

                    } else if (type === "ban") {
                        /* Ban the user. */
                        await bot.db.users.ban(db, {
                            by: original.user.id,
                            reason: content,
                            status: true
                        });
                    }

                    /* Fetch the user's infractions again. */
                    db = await bot.db.users.fetchUser(author);
                    const infractions: DatabaseUserInfraction[] = db.infractions;

                    /* Edit the original flag message. */
                    await original.message.edit(new Response()
                        /* Add the original flag embed. */
                        .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                        .addEmbed(builder => builder
                            .setAuthor({ name: original.user.tag, iconURL: original.user.displayAvatarURL() })
                            .setTitle(type === "warn" ? "Warning given ✉️" : "Banned 🔨")
                            .setDescription(`\`\`\`\n${infractions[infractions.length - 1].reason}\n\`\`\``)
                            .setColor("Green")
                            .setTimestamp()
                        )
                    .get() as MessageEditOptions);
                }
            };

            setTimeout(() => bot.client.off("interactionCreate", listener), 60 * 1000);
            bot.client.on("interactionCreate", listener);

            await original.showModal(modal);

        } catch (_) {}

    /* Perform a quick moderation action on the user */
    } else if (type === "quick" && original.isStringSelectMenu()) {
        /* Action to perform & specified reason */
        const action: "ban" | "warn" = data.shift()! as any;
        const reason: string = original.values[0];

        if (action === "warn") {
            await bot.db.users.warn(db, {
                by: original.user.id, reason
            });

        } else if (action === "ban") {
            await bot.db.users.ban(db, {
                by: original.user.id, reason, status: true
            });
        }

        /* Edit the original flag message. */
        await original.message.edit(new Response()
            .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

            .addEmbed(builder => builder
                .setAuthor({ name: original.user.tag, iconURL: original.user.displayAvatarURL() })
                .setTitle(action === "warn" ? "Warning given ✉️" : "Banned 🔨")
                .setDescription(`\`\`\`\n${reason}\n\`\`\``)
                .setColor("Green")
                .setTimestamp()
            )
        .get() as MessageEditOptions);

    /* View information about a user */
    } else if (type === "view") {
        const response: Response = (await buildUserOverview(bot, { id: author.id, name: author.tag, created: author.createdTimestamp, icon: author.displayAvatarURL() }, db))
            .setEphemeral(true);

        await original.reply(response.get() as InteractionReplyOptions);

    /* Prevent other moderators from taking actions for this flagged message */
    } else if (type === "lock") {
        await original.message.edit(
            new Response()
                .addEmbed(EmbedBuilder.from(original.message.embeds[0]).setColor("Grey").setFooter({ text: `Locked by ${original.user.tag} • ${original.message.embeds[0].footer!.text}` }))
            .get() as MessageEditOptions
        );

    /* Generate a warning message using ChatGPT */
    } else if (type === "ai") {
        /* Previous message sent by the user, in the embed of the moderation notice */
        const content: string = original.message.embeds[0].description!
            .replaceAll("```", "").trim();

        /* Whether the flagged message is by the bot or user */
        const source: string = data.shift()!;
        const flaggedFor: string | null = data.length > 0 ? data.shift()! : null;

        const messages: OpenAIChatMessage[] = [
            {
                content:
`You will look at the user's or bot's response message to a message by the bot/user, and determine whether the user should receive a warning.
You will see what the specified message was flagged for. Write the warning message in English only, but you can understand all languages to determine whether to warn the user.
Do not warn users for not speaking English, you understand all languages.

If the user should receive a warning for the message, write a short warning message sent to them. (not a full sentence as a response, nothing else about the warning system or yourself)
Keep them really short, avoiding sentences like "X is against our guidelines", instead simply reply e.g. "Hate speech". If they shouldn't receive a warning, simply reply with "null".`,

                role: "system"
            },

            { content: "User: i will kill all minorities\nFlagged for: Hate speech",  role: "assistant" },
            { content: `Derogatory language`, role: "assistant" },

            { content: "User: this sucks so much\nFlagged for: hate", role: "assistant" },
            { content: "null", role: "assistant" },

            { content: "User: я ненавижу геев\nFlagged for: hate", role: "assistant" },
            { content: "Homophobic comment", role: "assistant" },      

            { content: "Bot: Here's the request message: A-S-S-H-O-L-E\nFlagged for: hate", role: "assistant" },
            { content: "Tricking bot into using inappropriate language", role: "assistant" },

            {
                content: `${source}: ${content}${flaggedFor ? `\n\nFlagged for: ${flaggedFor}` : ""}\n\nWarning message:`,
                role: "assistant"
            }
        ]

        /* This might take a while ... */
        await original.deferUpdate();

        let buttons: ButtonBuilder[] = (ActionRowBuilder.from(original.message.components[0] as any) as ActionRowBuilder<ButtonBuilder>)
            .components

            .map(c => {
                if ((c.toJSON() as APIButtonComponentWithCustomId).custom_id.startsWith("ai")) c.setDisabled(true);
                return c;
            });

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(buttons);

        /* Disable the generation button, while the message is generating. */
        await original.message.edit({
            embeds: original.message.embeds,
            components: [ row, ...original.message.components.slice(1) ]
        });

        /* Whether to send the warning message */
        let send: boolean = false;

        try {
            /* Generate the warning message. */
            const response = await bot.ai.chat({
                model: "gpt-3.5-turbo",
                temperature: 1,
                stream: true,
                messages,
                stop: [ "null", "Null", "." ]
            });

            const notice: string = response.response.message.content;

            /* If no warning message was generated, show a notice to the moderator. */
            if (notice.length === 0 || notice.toLowerCase().includes("null")) return void await original.reply(new Response()
                .addEmbed(builder => builder
                    .setDescription("No warning message was generated by **ChatGPT** 😕")
                    .setColor("Yellow")
                )
                .setEphemeral(true)
            .get() as InteractionReplyOptions);

            const interaction: Message = await original.followUp(new Response()
                .addEmbed(builder => builder
                    .setTitle("Generated warning 🤖")
                    .setAuthor({ name: original.user.tag, iconURL: original.user.displayAvatarURL() })
                    .setDescription(`\`\`\`\n${notice}\n\`\`\``)
                    .setColor("Yellow")
                )
                .addComponent(ActionRowBuilder<ButtonBuilder>,
                    new ActionRowBuilder()
                        .addComponents(
                            new ButtonBuilder()
                                .setLabel("Send")
                                .setEmoji("✉️")
                                .setStyle(ButtonStyle.Secondary)
                                .setCustomId("send")
                        )
                )
                .setEphemeral(true)
            .get() as InteractionReplyOptions);

            const collector = interaction.createMessageComponentCollector<ComponentType.Button>({
                componentType: ComponentType.Button,
                filter: i => i.user.id === original.user.id && i.customId === "send",
                time: 15 * 1000,
                max: 1
            });

            collector.once("collect", () => { send = true; });

			/* When the collector is done, delete the reply message & continue the execution. */
			await new Promise<void>(resolve => collector.on("end", async () => {
				await original.deleteReply().catch(() => {});
				resolve();
			}));

            if (send) {
                /* Send the warning to the user. */
                await bot.db.users.warn(db, {
                    by: original.user.id,
                    automatic: true,
                    reason: notice
                });

                /* Edit the original flag message. */
                await original.message.edit(new Response()
                    /* Add the original flag embed. */
                    .addEmbed(EmbedBuilder.from(original.message.embeds[0]))

                    .addEmbed(builder => builder
                        .setTitle("Warning given 🤖")
                        .setAuthor({ name: original.user.tag, iconURL: original.user.displayAvatarURL() })
                        .setDescription(`\`\`\`\n${notice}\n\`\`\``)
                        .setColor("Green")
                        .setTimestamp()
                    )
                .get() as MessageEditOptions);
            }

        } catch (error) {
            if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Empty) return void await original.followUp(new Response()
                .addEmbed(builder => builder
                    .setDescription("No warning message was generated by **ChatGPT** 😕")
                    .setColor("Yellow")
                )
                .setEphemeral(true)
            .get() as InteractionReplyOptions);

            await original.followUp(new Response()
                .addEmbed(builder => builder
                    .setTitle("Failed to generate warning message ❌")
                    .setDescription(`\`\`\`\n${(error as Error).toString()}\n\`\`\``)
                    .setColor("Red")
                )
                .setEphemeral(true)
            .get() as InteractionReplyOptions);

        } finally {
            if (!send) {
                /* Enable the message generation button again. */
                buttons = buttons.map(c => {
                    if ((c.toJSON() as APIButtonComponentWithCustomId).custom_id.startsWith("ai")) c.setDisabled(false);
                    return c;
                });

                const row = new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(buttons);

                await original.message.edit({
                    embeds: original.message.embeds,
                    components: [ row, ...original.message.components.slice(1) ]
                });
            }
        }
    }
}

export const buildBanNotice = (bot: Bot, user: DatabaseUser, infraction: DatabaseUserInfraction): Response => {
    return new Response()
        .addEmbed(builder => builder
            .setTitle(`You were banned **permanently** from the bot 😔`)
            .setDescription("*You may have been banned for previous messages; this message is not the cause for your ban*.")
            .addFields({
                name: "Reason",
                value: infraction.reason ?? "Inappropriate use of the bot"
            })
            .setFooter({ text: "View /support on how to appeal this ban" })
            .setTimestamp(infraction.when)
            .setColor("Red")
        );
}

export const buildUserOverview = async (bot: Bot, target: FindResult, db: DatabaseUser): Promise<Response> => {
    /* Overview of the users' infractions in the description */
    const infractions: DatabaseUserInfraction[] = db.infractions.filter(i => i.type !== "moderation");
    let description: string | null = null;

    /* List of moderators for the infractions */
    const moderators: Collection<Snowflake, User> = new Collection();

    for (const infraction of infractions) {
        if (!infraction.by || moderators.has(infraction.by)) continue;

        /* Fetch the moderator, who took this action. */
        const user: User = await bot.client.users.fetch(infraction.by);
        moderators.set(user.id, user);
    }

    if (infractions.length > 0) description = infractions
        .map(i => `${ActionToEmoji[i.type]} \`${i.type}\`${i.by ? ` by **${moderators.get(i.by)!.tag}**` : ""} @ <t:${Math.round(i.when / 1000)}:f>${i.seen !== undefined ? i.seen ? " ✅" : " ❌" : ""}${i.reason ? ` » *\`${i.reason}\`*` : ""}${i.automatic ? " 🤖" : " 👤"}`)
        .join("\n");

    if (infractions.length > 0) description = `__**${infractions.length}** infractions__\n\n${description}`;

    /* Previous automated moderation flags for the user */
    const flags: DatabaseUserInfraction[] = db.infractions.filter(i => i.type === "moderation" && i.moderation);
    const shown: DatabaseUserInfraction[] = flags.slice(-5);
    
    /* Format the description for previous automated moderation flags. */
    let flagDescription: string | null = null;
    if (flags.length > 0) flagDescription = `${flags.length - shown.length !== 0 ? `(*${flags.length - shown.length} previous flags ...*)\n\n` : ""}${shown.map(f => `<t:${Math.round(f.when / 1000)}:f> » ${f.moderation!.auto ? `\`${f.moderation!.auto.action}\` ` : ""}${FlagToEmoji[f.moderation!.source]} » \`${f.moderation!.reference.split("\n").length > 1 ? `${f.moderation!.reference.split("\n")[0]} ...` : f.moderation!.reference}\``).join("\n")}`

    /* Formatted interactions count, for each category */
    let interactionsDescription: string = "";

    for (const [ category, count ] of Object.entries(db.interactions)) {
        interactionsDescription = `${interactionsDescription}\n${Utils.titleCase(category)} ▶️ **${count}** times`;
    }

    /* Formatted meta-data values, for each type */
    let metadataDescription: string = "";

    for (const [ key, value ] of Object.entries(db.metadata)) {
        if (!value) continue;
        metadataDescription = `${metadataDescription}\n${Utils.titleCase(key)} ▶️ \`${value}\``;
    }

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
                    value: `<t:${Math.floor(db.created / 1000)}:f>`,
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
                    value: db.subscription !== null ? `✅ - expires *${dayjs.duration(db.subscription.expires - Date.now()).humanize(true)}*` : "❌",
                    inline: true
                },

                {
                    name: "Roles ⚒️",
                    value: [ ... bot.db.role.roles(db), "*User*" ].map(role => `**${Utils.titleCase(role)}**`).join(", "),
                    inline: true
                },

                {
                    name: "Voted 📩",
                    value: db.voted ? `<t:${Math.round(Date.parse(db.voted) / 1000)}:R>` : "❌",
                    inline: true
                },

                {
                    name: "Banned ⚠️",
                    value: bot.db.users.banned(db) ? "✅" : "❌",
                    inline: true
                }
            )
            .setColor(bot.branding.color)
        );

    if (flagDescription !== null) response.addEmbed(builder => builder
        .setDescription(Utils.truncate(flagDescription!, 2000))
        .setColor("Purple")
    );

    return response;
}

/**
 * Build the moderation toolbar.
 * 
 * @param options Moderation send options
 * @param include Which optional buttons to include
 * 
 * @returns The constructed action row, with the buttons
 */
export const buildModerationToolbar = (user: User, result: ModerationResult): ActionRowBuilder[] => {
    const buildIdentifier = (type: ModerationToolbarAction | string, args?: string[]) => `${type}:${user.id}${args && args.length > 0 ? `:${args.join(":")}` : ""}`;
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

/**
 * Send a moderation flag to the log channel, for moderators to review the flagged message.
 * 
 * @param options Moderation send options
 */
export const sendModerationMessage = async ({ result, conversation, db, content, type, notice, options }: ModerationSendOptions) => {
    /* Get the moderation channel. */
    const channel = await messageChannel(conversation.manager.bot, "moderation");

    /* Description of the warning embed */
    const description: string = Utils.truncate(result.translation ? `(Translated from \`${result.translation.detected}\`)\n*\`\`\`\n${result.translation.content}\n\`\`\`*` : `\`\`\`\n${content}\n\`\`\``, 4096);

    /* Toolbar component rows */
    const rows = buildModerationToolbar(conversation.user, result);

    /* Send the moderation message to the channel. */
    const reply = new Response()
        .addEmbed(builder => builder
            .setTitle(`${FlagToName[type]} ${FlagToEmoji[type]}`)
            .addFields(
                {
                    name: "Infractions ⚠️",
                    value: "`" + db.user.infractions.filter(i => i.type === "warn").length + "`",
                    inline: true
                }
            )
            .setDescription(description)
            .setAuthor({ name: `${conversation.user.tag} [${conversation.user.id}]`, iconURL: conversation.user.displayAvatarURL() })
            .setFooter({ text: `Cluster #${conversation.manager.bot.data.id + 1}` })
            .setColor("Yellow")
            .setTimestamp()
        );

    /* Add the toolbar rows to the reply. */
    rows.forEach(row => reply.addComponent(ActionRowBuilder<ButtonBuilder>, row));

    if (notice) {
        reply.embeds[0].addFields(
            {
                name: "Notice 📝",
                value: `\`${notice}\``,
                inline: true
            }
        )
    }

    if (result.auto) {
        reply.embeds[0].addFields(
            {
                name: "Filter 🚩",
                value: `\`${result.auto!.reason ?? result.auto!.action}\``,
                inline: true
            },

            {
                name: "Action ⚠️",
                value: `\`${result.auto!.type}\` ${ActionToEmoji[result.auto!.type as any]}`,
                inline: true
            }
        );
    }
    
    if (!result.auto) reply.embeds[0].addFields({
        name: "Blocked ⛔",
        value: result.blocked ? "✅" : "❌",
        inline: true
    });

    if (result.source === "image" && options.additional && options.additional.model) reply.embeds[0].addFields(
        {
            name: "Model 😊",
            value: `\`${options.additional.model}\``,
            inline: true
        },

        {
            name: "NSFW 🔞",
            value: options.additional.nsfw ? "✅" : "❌",
            inline: true
        }
    );

    await channel.send(reply.get() as any);
}

export const sendImageModerationMessage = async (options: ModerationImageSendOptions): Promise<void> => {
    return sendModerationMessage({
        ...options,
        
        options: { ...options, source: "image" },
        type: "image"
    });
}