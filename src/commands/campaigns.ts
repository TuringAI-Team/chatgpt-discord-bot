import { ActionRowBuilder, AttachmentBuilder, Awaitable, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, ColorResolvable, Colors, Interaction, InteractionReplyOptions, MessageEditOptions, ModalBuilder, ModalSubmitInteraction, SlashCommandBuilder, Snowflake, StringSelectMenuBuilder, StringSelectMenuInteraction, TextInputBuilder, TextInputStyle, User, resolveColor } from "discord.js";
import { randomUUID } from "crypto";
import words from "random-words";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../interaction/handler.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { CampaignInteractionHandlerData } from "../interactions/campaign.js";
import { DatabaseCampaign } from "../db/managers/campaign.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

interface BuildOverviewOptions {
    db: DatabaseInfo;
    campaign: DatabaseCampaign;
    interaction: ChatInputCommandInteraction | ButtonInteraction | StringSelectMenuInteraction;
}

type BuildFinderOptions = Omit<BuildOverviewOptions, "campaign">

type BuildSelectorOptions = Omit<BuildOverviewOptions, "campaign"> & {
    campaigns: DatabaseCampaign[];
}

interface CampaignParameterLength {
    min?: number;
    max?: number;
}

interface CampaignParameterValidation {
    message: string;
}

interface CampaignParameter {
    /** Name of the parameter */
    name: string;

    /* Tooltip for the modal */
    tooltip?: string;

    /* Whether this parameter is optional */
    optional?: boolean;

    /** Which input type this parameter is */
    type: TextInputStyle;

    /** Minimum & maximum length restrictions of the parameter */
    length?: CampaignParameterLength;

    /* Function to call, to validate the user's input */
    validate?: (value: string, db: DatabaseInfo, bot: Bot) => Awaitable<CampaignParameterValidation | boolean>;

    /* Function to call, to update the campaign in the database */
    update: (value: string, old: DatabaseCampaign, bot: Bot) => Awaitable<Partial<DatabaseCampaign>>;

    /* Function to call, to get the previous value of this variable */
    previous: (campaign: DatabaseCampaign) => Awaitable<string | null>;
}

const CampaignParameters: CampaignParameter[] = [
    {
        name: "Name",
        type: TextInputStyle.Short,
        length: { min: 3, max: 64 },
        validate: async (value, _, bot) => {
            const all: DatabaseCampaign[] = await bot.db.campaign.all();
            if (all.find(c => c.name === value) != undefined) return { message: "a campaign with this name already exists" };

            return true;
        },
        update: value => ({ name: value }),
        previous: c => c.name
    },

    {
        name: "Link",
        type: TextInputStyle.Short,
        length: { min: 1, max: 128 },
        validate: value => {
            try {
                new URL(value);
                return true;
            } catch (error) {
                return { message: "invalid URL" };
            }
        },
        update: value => ({ link: value }),
        previous: c => c.link
    },

    {
        name: "Budget",
        type: TextInputStyle.Short,
        length: { min: 1, max: 10 },
        validate: value => {
            const num: number = parseFloat(value);
            if (isNaN(num)) return { message: "not a valid number" };

            if (num === 0) return { message: "has to be bigger than zero" };
            if (num > 1000) return { message: "may not be bigger than $1000" };

            const decimalPlaces: number = (num.toString().split(".")[1] || '').length;
            if (decimalPlaces > 2) return { message: "may not have more than 2 decimal places" };

            return true;
        },
        update: value => ({ budget: parseFloat(value) }),
        previous: c => c.budget.toString()
    },

    {
        name: "Members",
        tooltip: "Member IDs, on each line",
        type: TextInputStyle.Paragraph,
        length: { max: 200 },
        validate: async (value, db, bot) => {
            const ids: string[] = value.split(/[ ,\n]+/);
            if (!ids.includes(db.user.id)) return { message: "you can't remove yourself" };

            for (const id of ids) {
                try {
                    await bot.client.users.fetch(id);
                } catch (_) {
                    return { message: `invalid member ID \`${id}\`` };
                }
            }

            return true;
        },
        update: value => ({ members: value.split(/[ ,\n]+/) }),
        previous: c => c.members.join("\n")
    },

    {
        name: "Embed title",
        type: TextInputStyle.Short,
        length: { min: 1, max: 256 },
        update: (value, old) => ({ settings: { ...old.settings, title: value } }),
        previous: c => c.settings.title
    },

    {
        name: "Embed description",
        type: TextInputStyle.Paragraph,
        length: { min: 1, max: 512 },
        update: (value, old) => ({ settings: { ...old.settings, description: value } }),
        previous: c => c.settings.description
    },

    {
        name: "Embed color",
        type: TextInputStyle.Short,
        length: { min: 1, max: 16 },
        validate: value => {
            try {
                resolveColor(value as ColorResolvable);
                return true;
            } catch (_) {
                return { message: "invalid color" };
            }
        },
        update: (value, old) => ({ settings: { ...old.settings, color: value as ColorResolvable } }),
        previous: c => c.settings.color as string ?? null
    },

    {
        name: "Embed image",
        optional: true,
        type: TextInputStyle.Short,
        length: { min: 1, max: 128 },
        validate: value => {
            try {
                new URL(value);
                return true;
            } catch (_) {
                return { message: "invalid URL" };
            }
        },
        update: (value, old) => ({ settings: { ...old.settings, image: value } }),
        previous: c => c.settings.image ?? null
    },

    {
        name: "Embed thumbnail",
        optional: true,
        type: TextInputStyle.Short,
        length: { min: 1, max: 128 },
        validate: value => {
            try {
                new URL(value);
                return true;
            } catch (error) {
                return { message: "invalid URL" };
            }
        },
        update: (value, old) => ({ settings: { ...old.settings, thumbnail: value } }),
        previous: c => c.settings.thumbnail ?? null
    },
]

/* Maximum amount of campaigns a user may be part of */
const MaxCampaignsPerUser: number = 5

export default class CampaignsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("campaigns")
				.setDescription("View & manage ad campaigns")
        , { restriction: [ "advertiser", "investor", "owner" ] });
    }

    public async buildOverviewToolbar({ campaign }: BuildOverviewOptions): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        const buildID = (action: string) => `campaign:ui:${action}:${campaign.id}`;

        const buttons: ButtonBuilder[] = [
            new ButtonBuilder()
            .setLabel("Back")
            .setEmoji("◀️")
            .setStyle(ButtonStyle.Secondary)
            .setCustomId(buildID("selector")),

            new ButtonBuilder()
                .setLabel(campaign.active ? "Disable" : "Enable")
                .setEmoji(campaign.active ? "❌" : "✅")
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(buildID("toggle")),

            new ButtonBuilder()
                .setLabel("Preview")
                .setEmoji("📜")
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(buildID("preview")),

            new ButtonBuilder()
                .setLabel("Statistics")
                .setEmoji("📊")
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(buildID("stats")),

            new ButtonBuilder()
                .setLabel("Delete").setEmoji("🗑️")
                .setStyle(ButtonStyle.Danger)
                .setCustomId(buildID("delete"))
        ];

        const builders: ActionRowBuilder<ButtonBuilder>[] = [];
        const chunks: ButtonBuilder[][] = Utils.chunk(buttons, 5);

        chunks.forEach(chunk => {
            const builder: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder();
            builder.addComponents(chunk);

            builders.push(builder);
        });

        return builders;
    }

    public async buildOverview(options: BuildOverviewOptions): Promise<Response> {
        const { campaign, db, interaction } = options;

        const modifiers = await this.buildModifierRows({ db, interaction, campaign });
        const toolbar = await this.buildOverviewToolbar(options);

        const members: User[] = await Promise.all(
            campaign.members.map(id => this.bot.client.users.fetch(id))
        );

        const fields: { name: string, value: string }[] = [
            { name: "Active", value: campaign.active ? "✅" : "❌" },
            { name: "Link", value: `<${campaign.link}>` },
            { name: "Members", value: `${members.map(member => `<@${member.id}>`).join(", ")}` },
            { name: "Budget", value: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(campaign.budget) },
            { name: "Views", value: new Intl.NumberFormat("en-US").format(campaign.stats.views.total) },
            { name: "Clicks", value: new Intl.NumberFormat("en-US").format(campaign.stats.clicks.total) }
        ];

        const response = new Response()
            .addEmbed(builder => builder
                .setTitle(`Overview for campaign \`${campaign.name}\``)
                .setColor(this.bot.branding.color)
                .setDescription(`${fields.map(f => `**${f.name}** • ${f.value}`).join("\n")}`)
            );

        [ ...toolbar, ...modifiers ].forEach(row => {
            response.addComponent(ActionRowBuilder<ButtonBuilder>, row);
        });

        const preview = await this.bot.db.campaign.render({
            campaign, db, preview: true
        });

        response.addEmbed(preview.response.embed);
        return response;
    }

    public async buildSelector({ campaigns }: BuildSelectorOptions): Promise<StringSelectMenuBuilder> {
        const builder: StringSelectMenuBuilder = new StringSelectMenuBuilder()
            .setCustomId("campaign:ui:selector")
            .setPlaceholder("Choose a campaign ...")
            .addOptions(campaigns.map(c => ({
				label: c.name,
                emoji: c.active ? "✅" : "❌",
				description: `${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c.budget)} • ${c.members.length} member${c.members.length > 1 ? "s" : ""}${c.filters && c.filters.length > 0 ? ` • ${c.filters.length} filter${c.filters.length > 1 ? "s" : ""}` : ""}`,
				value: c.id
            })));

        return builder;
    }

    public async buildFinderToolbar(_: BuildSelectorOptions): Promise<ActionRowBuilder<ButtonBuilder>> {
        const buttons: ButtonBuilder[] = [
            new ButtonBuilder()
                .setLabel("Create a campaign")
                .setEmoji("🔧")
                .setCustomId("campaign:ui:create")
                .setStyle(ButtonStyle.Secondary),

                new ButtonBuilder()
                .setLabel("Refresh campaigns")
                .setEmoji("🔄")
                .setCustomId("campaign:ui:refresh")
                .setStyle(ButtonStyle.Secondary)
        ];

        return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
    }

    public async campaigns({ db }: BuildFinderOptions): Promise<DatabaseCampaign[]> {
        const campaigns: DatabaseCampaign[] = (await this.bot.db.campaign.all())
            .filter(c => this.bot.db.role.owner(db.user) || c.members.includes(db.user.id));

        return campaigns;
    }

    public async buildFinder({ db, interaction }: BuildFinderOptions): Promise<Response> {
        const campaigns: DatabaseCampaign[] = await this.campaigns({ db, interaction });

        const selector = campaigns.length > 0 ? await this.buildSelector({ db, interaction, campaigns }) : null;
        const toolbar = await this.buildFinderToolbar({ db, interaction, campaigns });

        const response = new Response()
            .addEmbed(builder => builder
                .setDescription(`## **Welcome, <@${db.user.id}> 👋**\n*To proceed, ${selector !== null ? "select a campaign you want to modify or create a new one" : "choose an option from below"}.*`)
                .setColor(this.bot.branding.color)
            );

        if (selector !== null) response.addComponent(ActionRowBuilder<StringSelectMenuBuilder>, new ActionRowBuilder().addComponents(selector))
        response.addComponent(ActionRowBuilder<ButtonBuilder>, toolbar);

        return response.setEphemeral(true);
    }

    public async buildModifierRows({ campaign }: BuildOverviewOptions): Promise<ActionRowBuilder<ButtonBuilder>[]> {
        const buttons: ButtonBuilder[] = CampaignParameters.map(p => new ButtonBuilder()
            .setLabel(p.name).setEmoji("📝")
            .setCustomId(`campaign:ui:modify:${campaign.id}:${p.name}`)
            .setStyle(ButtonStyle.Primary)
        );

        const builders: ActionRowBuilder<ButtonBuilder>[] = [];
        const chunks: ButtonBuilder[][] = Utils.chunk(buttons, 5);

        chunks.forEach(chunk => {
            builders.push(new ActionRowBuilder<ButtonBuilder>().addComponents(chunk));
        });

        return builders;
    }

    public async handleInteraction({ db, interaction, raw }: InteractionHandlerRunOptions<ButtonInteraction | StringSelectMenuInteraction, CampaignInteractionHandlerData>): InteractionHandlerResponse {
        /* Remove the `ui` identifier from the ID. */
        raw.shift();

        /* Which action to perform */
        const action = raw.shift()!;

        if (action === "selector" && interaction instanceof StringSelectMenuInteraction) {
            const id: string = interaction.values[0];

            const campaign: DatabaseCampaign | null = await this.bot.db.campaign.get(id);
            if (campaign === null) return;

            const overview: Response = await this.buildOverview({ db, interaction, campaign });
            await interaction.update(overview.get() as MessageEditOptions);

        } else if (action === "selector" && interaction instanceof ButtonInteraction) {
            const response: Response = await this.buildFinder({ db, interaction });
            await interaction.update(response.get() as MessageEditOptions);

        } else if (action === "create") {
            const campaigns: DatabaseCampaign[] = await this.campaigns({ db, interaction });

            if (campaigns.length >= MaxCampaignsPerUser) return new ErrorResponse({
                message: `You cannot be part of more than **${MaxCampaignsPerUser}** campaigns`
            })

            const name: string = (words as any)({
                join: "-", exactly: 4
            });

            const campaign: DatabaseCampaign = await this.bot.db.campaign.create({
                name: name,
                budget: 1, members: [ db.user.id ],
                link: "https://turing.sh",

                settings: {
                    title: "This is your advertisement 👋",
                    description: "This embed shows up on various cool-down messages of the bot, and you can change its look using the buttons below. You can use Markdown **formatting** *here* __too__, ||if you want||. Once you've configured the ad to your liking, deploy it using the **✅ Enable** button.",
                    thumbnail: "https://turing.sh/neon.png",
                    color: "Yellow"
                }
            });

            const overview: Response = await this.buildOverview({ db, interaction, campaign });
            await interaction.update(overview.get() as MessageEditOptions);

        } else if (action === "refresh") {
            await interaction.deferReply({ ephemeral: true });
            const campaigns: DatabaseCampaign[] = await this.bot.db.campaign.refresh();

            return new Response()
                .addEmbed(builder => builder
                    .setDescription(`Loaded **${campaigns.length}** campaigns ✅`)
                    .setColor("Green")
                );

        } else if (action === "modify") {
            /* ID of the campaign */
            const id = raw.shift()!;

            let campaign: DatabaseCampaign | null = await this.bot.db.campaign.get(id);
            if (campaign === null) return;

            /* Name of the property to modify */
            const name = raw.shift()!;

            /* Which parameter this modifies */
            const param: CampaignParameter = CampaignParameters.find(p => p.name === name)!;
            const previous: string | null = await param.previous(campaign);

            const customID: string = randomUUID();

            const input: TextInputBuilder = new TextInputBuilder()
                .setCustomId("value")
                .setRequired(param.optional != undefined ? !param.optional : true)
                .setStyle(param.type)
                .setPlaceholder("Enter a new value...")
                .setLabel(`${param.tooltip ?? param.name}${
                    param.length ?
                        ` (${
                            param.length.min && param.length.max ? `${param.length.min}-${param.length.max}`
                            : param.length.min && !param.length.max
                                ? `min. ${param.length.min}`
                                : param.length.max && !param.length.min
                                    ? `max. ${param.length.max}`
                                    : ""
                        })`
                    : ""
                }`)
                .setMinLength(param.length && param.length.min ? param.length.min : 1)
                .setMaxLength(param.length && param.length.max ? param.length.max : 999);

            if (previous !== null) input.setValue(previous);

            const builder: ModalBuilder = new ModalBuilder()
                .setCustomId(customID)
                .setTitle(`Change the value 📝`)
                .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));

            /* Show the model to the user, then waiting for their input. */
            await interaction.showModal(builder);

            /* New, updated value */
            let updated: string = null!;
            let modal: ModalSubmitInteraction = null!;

            /* Wait for the user to submit the modal. */
            await new Promise<void>(resolve => {
                const clean = () => {
                    this.bot.client.off("interactionCreate", listener);
                    clearTimeout(timer);
                    resolve();
                }

                const timer = setTimeout(() => {
                    clean();
                }, 60 * 1000);

                const listener = async (modalInteraction: Interaction) => {
                    if (!modalInteraction.isModalSubmit() || modalInteraction.user.id !== db.user.id || modalInteraction.customId !== customID) return;

                    /* Raw, new value */
                    const raw: string = modalInteraction.fields.getTextInputValue("value");

                    updated = raw.length > 0 ? raw : null!;
                    modal = modalInteraction;

                    clean();
                };

                this.bot.client.on("interactionCreate", listener);
            });

            if (updated === null && modal === null) return;

            /* Whether the new value validates the checks */
            const validated: CampaignParameterValidation | boolean = param.validate && updated !== null ? await param.validate(updated, db, this.bot) : true;

            if (validated === false || typeof validated === "object") return void await modal.reply(new ErrorResponse({
                message: `The value specified for parameter \`${param.name}\` is invalid${typeof validated === "object" ? `; **${validated.message}**` : ""}`
            }).get() as InteractionReplyOptions);

            /* Apply all database changes. */
            const changes: Partial<DatabaseCampaign> = await param.update(updated, campaign, this.bot);
            campaign = await this.bot.db.campaign.update(campaign, changes);

            await modal.deferUpdate().catch(() => {});

            const overview: Response = await this.buildOverview({ db, interaction, campaign });
            await interaction[interaction.replied ? "editReply" : "update"](overview.get() as MessageEditOptions);

        } else {
            /* ID of the campaign */
            const id = raw[0];

            let campaign: DatabaseCampaign | null = await this.bot.db.campaign.get(id);
            if (campaign === null) return;

            if (action === "toggle") {
                campaign = await this.bot.db.campaign.update(campaign, {
                    active: !campaign.active
                });

            } else if (action === "delete") {
                await this.bot.db.campaign.delete(campaign);

                const response: Response = await this.buildFinder({ db, interaction });
                return void await interaction.update(response.get() as MessageEditOptions);

            } else if (action === "preview") {
                const { response: { embed, row } } = await this.bot.db.campaign.render({
                    campaign, db, preview: true
                });

                return new Response()
                    .addComponent(ActionRowBuilder<ButtonBuilder>, row)
                    .addEmbed(embed).setEphemeral(true);
                    
            } else if (action === "stats") {
                const charts = await this.bot.db.campaign.charts(campaign);
                const response = new Response().setEphemeral(true);

                for (const chart of charts) {
                    const id: string = randomUUID();

                    response.addAttachment(
                        new AttachmentBuilder(chart.data).setName(`${id}.png`)
                    );

                    response.addEmbed(builder => builder
                        .setTitle(chart.name)
                        .setImage(`attachment://${id}.png`)
                        .setColor(this.bot.branding.color)
                    );
                }

                return response;
            }

            const overview: Response = await this.buildOverview({ db, interaction, campaign });
            await interaction.update(overview.get() as MessageEditOptions);
        }
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
        const response: Response = await this.buildFinder({ db, interaction });
        return response;
    }
}