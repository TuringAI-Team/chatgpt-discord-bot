import { ActionRowBuilder, Awaitable, ButtonBuilder, ButtonInteraction, ButtonStyle, ColorResolvable, EmbedBuilder, Snowflake } from "discord.js";
import ChartJsImage from "chartjs-to-image";
import { randomUUID } from "crypto";
import { URL } from "url";
import chalk from "chalk";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../../interaction/handler.js";
import { CampaignInteractionHandlerData } from "../../interactions/campaign.js";
import { DatabaseManager, DatabaseManagerBot } from "../manager.js";
import CampaignsCommand from "../../commands/campaigns.js";
import { GPTDatabaseError } from "../../error/db.js";
import { ChatButton } from "../../chat/types/button.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { Response } from "../../command/response.js";
import { AppDatabaseManager } from "../app.js";
import { SubDatabaseManager } from "../sub.js";
import { DatabaseInfo } from "./user.js";

type DatabaseCampaignButton = ChatButton

interface DatabaseCampaignSettings {
    /** Title of the campaign, to display in the embed */
    title: string;

    /** Description of the campaign, to display in the embed */
    description: string;

    /** Color of the embed, optional */
    color?: ColorResolvable;

    /** Image of the embed, optional */
    image?: string;

    /** Thumbnail of the embed, optional */
    thumbnail?: string;

    /** Buttons underneath the message, optional */
    buttons?: DatabaseCampaignButton[];
}

interface DatabaseCampaignStatistics {
    clicks: {
        /** Total amount of clicks to this campaign */
        total: number;

        /** Geo-specific clicks */
        geo: Record<string, number>;
    };

    views: {
        /** Total amount of views to this campaign */
        total: number;

        /** Geo-specific views */
        geo: Record<string, number>;
    };
}

type DatabaseCampaignFilterData = string | (string | number)[] | any

interface DatabaseCampaignFilterCall<T extends DatabaseCampaignFilterData = any> {
    /** Which filter to use */
    name: string;

    /** Data to pass to the filter */
    data: T;
}

interface DatabaseCampaignFilterContext<T extends DatabaseCampaignFilterData = any> {
    data: T;
    db: DatabaseInfo;
}

interface DatabaseCampaignFilter<T extends DatabaseCampaignFilterData = any> {
    /** Name of the filter */
    name: string;

    /** Executor of the filter */
    execute: (context: DatabaseCampaignFilterContext<T>) => boolean;
}

export const DatabaseCampaignFilters: DatabaseCampaignFilter[] = [
    {
        name: "countries",
        execute: ({ data, db }) => {
            if (!db.user.metadata.country) return false;
            return data.includes(db.user.metadata.country);
        }
    } as DatabaseCampaignFilter<string[]>
]

export interface DatabaseCampaign {
    /** Unique identifier of the campaign */
    id: string;

    /** Name of the campaign */
    name: string;

    /** When the campaign was created */
    created: string;

    /** Whether the campaign is active */
    active: boolean;

    /* What the budget of this campaign is */
    budget: number;

    /** Discord IDs of the members of this campaign */
    members: Snowflake[];

    /** Which filters to apply */
    filters: DatabaseCampaignFilterCall[] | null;

    /** Link to the the campaign's target site */
    link: string;

    /** Settings of the campaign, used for storing title, description, etc. */
    settings: DatabaseCampaignSettings;

    /** Statistics of the campaign, e.g. how many clicks */
    stats: DatabaseCampaignStatistics;
}

export type CreateCampaignOptions = Omit<DatabaseCampaign, "stats" | "active" | "id" | "filters" | "created">

export type PartialDatabaseCampaign = Omit<DatabaseCampaign, "stats" | "active" | "id"> & {
    id: string;
}

export interface DisplayCampaignResponse {
    embed: EmbedBuilder;
    row: ActionRowBuilder<ButtonBuilder> | null;
}

export interface DisplayCampaign {
    db: DatabaseCampaign;
    response: DisplayCampaignResponse;
}

export interface CampaignPickOptions {
    /* How many campaigns to choose, default 1 */
    count?: number;

    /* Which user to display this campaign to */
    db: DatabaseInfo;
}

interface CampaignChart {
    name: string;
    data: Buffer;
}

interface CampaignChartDesigner {
    name: string;
    type: "chart" | "pie";

    run: (campaign: DatabaseCampaign, chart: ChartJsImage) => Awaitable<any>;
}

type CampaignRenderOptions = Pick<CampaignPickOptions, "db"> & { campaign: DatabaseCampaign, preview?: boolean }
type CampaignRunFilterOptions = Pick<CampaignPickOptions, "db"> & { campaign: DatabaseCampaign }

export class BaseCampaignManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {
    
}

export class ClusterCampaignManager extends BaseCampaignManager<ClusterDatabaseManager> {
    public async refresh(): Promise<DatabaseCampaign[]> {
        return await this.db.eval(async app => {
            return await app.db.campaign.load();
        });
    }

    /**
     * Get all available campaigns.
     * @returns Available campaigns
     */
    public async all(): Promise<DatabaseCampaign[]> {
        return await this.db.eval(async app => {
            return app.db.campaign.campaigns;
        });
    }
    
    public async get(id: string): Promise<DatabaseCampaign | null> {
        return await this.db.fetchFromCacheOrDatabase<string, DatabaseCampaign>(
			"campaigns", id
		);
    }

    public async create(options: CreateCampaignOptions): Promise<DatabaseCampaign> {
        /* Generate a random UUID for the campaign. */
        const id: string = randomUUID();

        /* Final creation options */
        const data: DatabaseCampaign = {
            filters: null, created: new Date().toISOString(), id,
            ...options, active: false, stats: { clicks: { geo: {}, total: 0 }, views: { geo: {}, total: 0 } }
        };

        const campaign: DatabaseCampaign = await this.db.createFromCacheOrDatabase(
			"campaigns", data
		);

        await this.db.eval(async (app, { campaign }) => {
            app.db.campaign.campaigns.push(campaign);
        }, {
            campaign
        });

        return campaign;
    }

    public async update(campaign: DatabaseCampaign, changes: Partial<DatabaseCampaign>): Promise<DatabaseCampaign> {
        const updated: DatabaseCampaign = await this.db.queue.update("campaigns", campaign, changes);

        await this.db.eval(async (app, { campaign }) => {
            const index: number = app.db.campaign.campaigns.findIndex(c => c.id === campaign.id);
            app.db.campaign.campaigns[index] = campaign;
        }, {
            campaign: updated
        });

        return updated;
    }

    public async delete(campaign: DatabaseCampaign): Promise<void> {
        await this.db.eval(async (app, { campaign }) => {
            const index: number = app.db.campaign.campaigns.findIndex(c => c.id === campaign.id);
            app.db.campaign.campaigns.splice(index, 1);
        }, {
            campaign
        });

        await this.db.delete("campaigns", campaign);
    }

    public async clearStatistics(campaign: DatabaseCampaign): Promise<DatabaseCampaign> {
        return this.update(campaign, {
            stats: {
                clicks: { geo: {}, total: 0 },
                views: { geo: {}, total: 0 }
            }
        })
    }

    public async updateStatistics(
        campaign: DatabaseCampaign, type: keyof DatabaseCampaignStatistics, updates: Partial<DatabaseCampaignStatistics["clicks"]>
    ): Promise<DatabaseCampaign> {
        const updated: DatabaseCampaignStatistics = {
            ...campaign.stats,

            [type]: {
                ...campaign.stats[type], ...updates,
                geo: { ...campaign.stats?.[type]?.geo ?? {}, ...updates.geo ?? {} }
            }
        };

        return this.update(campaign, {
            stats: updated
        });
    }

    public async increment(campaign: DatabaseCampaign, type: keyof DatabaseCampaignStatistics, db: DatabaseInfo): Promise<DatabaseCampaign> {
        let updates: Partial<DatabaseCampaignStatistics["clicks"]> & { geo: Record<string, number> } = {
            total: (campaign.stats[type]?.total ?? 0) + 1, geo: {}
        };

        const country: string | null = db.user.metadata.country ?? null;
        if (country !== null) updates.geo[country] = campaign.stats[type]?.geo?.[country] ? campaign.stats[type].geo[country] + 1 : 1;

        await this.db.metrics.changeCampaignsMetric({
            [type]: {
                total: { [campaign.name]: updates.total },
                now: { [campaign.name]: "+1" }
            }
        });

        return this.updateStatistics(campaign, type, updates);
    }

    public async pick({ db }: Omit<CampaignPickOptions, "count">): Promise<DatabaseCampaign | null> {
        const sorted: DatabaseCampaign[] = (await this.all())
            .filter(c => c.active && this.executeFilters({ campaign: c, db }));

        /* Final chosen campaign */
        let final: DatabaseCampaign = null!;

        const totalBudget: number = sorted.reduce(
            (previous, campaign) => previous + campaign.budget, 0
        );

        const random: number = Math.floor(Math.random() * 100) + 1;

        let start: number = 0;
        let end: number = 0;

        for (const campaign of sorted) {
            let percent: number = Math.round((campaign.budget / totalBudget) * 100);
            end += percent;

            if (percent > 20) percent = 20 - (percent - 20);
            if (percent < 5) percent = 5 + (10 - percent);

            if (random > start && random <= end) {
                final = campaign;
                break;
            }

            start += percent;
        }

        if (final === null) return null;
        return final;
    }

	/**
	 * Choose an ad from the available list, to display in the bot's response.
	 */
	public async ad(options: Pick<CampaignPickOptions, "db">): Promise<DisplayCampaign | null> {
		let campaign: DatabaseCampaign | null = await this.pick(options);
		if (campaign === null) return null;

        /* Increment the views for this campaign. */
        campaign = await this.increment(campaign, "views", options.db);

		const ad: DisplayCampaign = await this.render({ campaign, db: options.db });
		return ad;
	}

    /**
     * Execute the filters of a campaign, on a user.
     * @returns Whether this ad matches all filters
     */
    public executeFilters({ campaign, db }: CampaignRunFilterOptions): boolean {
        if (campaign.filters === null || campaign.filters.length === 0) return true;

        for (const call of campaign.filters) {
            const filter: DatabaseCampaignFilter | null = DatabaseCampaignFilters.find(f => f.name === call.name) ?? null;
            if (filter === null) continue;

            const result: boolean = filter.execute({ db, data: call.data });
            if (!result) return false;
        }

        return true;
    }

    public async render({ campaign, preview }: CampaignRenderOptions): Promise<DisplayCampaign> {
        const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder();
        const embed: EmbedBuilder = new EmbedBuilder();

        embed.setTitle(campaign.settings.title);
        embed.setDescription(campaign.settings.description);
        embed.setColor(campaign.settings.color ?? this.db.config.branding.color);
        if (campaign.settings.image) embed.setImage(campaign.settings.image);
        if (campaign.settings.thumbnail) embed.setThumbnail(campaign.settings.thumbnail);
        embed.setFooter({ text: preview ? "This is a preview of your advertisement." : "This is a sponsored advertisement." });

		/* If the message has any additional buttons attached, add them to the resulting message. */
		if (campaign.settings.buttons && campaign.settings.buttons.length > 0) {
			const buttons: ButtonBuilder[] = [];

			campaign.settings.buttons.forEach(button => {
				const builder = new ButtonBuilder()

                if (button.emoji) builder.setEmoji(button.emoji);
                builder.setLabel(button.label);

                if (button.id === "campaign") {
                    builder.setCustomId(`campaign:link:${campaign.id}`);
                    builder.setEmoji("<:share:1122241895133884456>");
                    builder.setStyle(ButtonStyle.Primary);
                } else {
                    if (!button.url) builder.setCustomId(button.id ?? randomUUID());
                    else builder.setURL(button.url);

                    builder
                        .setLabel(button.label)
                        .setDisabled(button.disabled ?? false)
                        .setStyle(button.url ? ButtonStyle.Link : button.style ?? ButtonStyle.Secondary);
                }

				buttons.push(builder);
			});

		    row.addComponents(buttons);
		} else {
            row.addComponents(
                new ButtonBuilder()
                    .setLabel("Visit")
                    .setCustomId(`campaign:link:${campaign.id}`)
                    .setEmoji("<:share:1122241895133884456>")
                    .setStyle(ButtonStyle.Primary)
            );
        }

        return {
            db: campaign, response: {
                embed, row: row.components.length > 0 ? row : null
            }
        };
    }

    public async charts(campaign: DatabaseCampaign): Promise<CampaignChart[]> {
        const designers: CampaignChartDesigner[] = [
            {
                name: "Views from countries",
                type: "pie",

                run: campaign => {
                    return {
                        data: {
                            datasets: [ {
                                data: Object.values(campaign.stats.views.geo)
                            } ],
                        
                            labels: Object.keys(campaign.stats.views.geo)
                        }
                    };
                }
            },

            {
                name: "Clicks from countries",
                type: "pie",

                run: campaign => {
                    return {
                        data: {
                            datasets: [ {
                                data: Object.values(campaign.stats.clicks.geo)
                            } ],
                        
                            labels: Object.keys(campaign.stats.clicks.geo)
                        }
                    };
                }
            }
        ];

        const final: CampaignChart[] = [];

        for (const designer of designers) {
            const chart = new ChartJsImage()
                .setWidth(700).setHeight(500);

            /* Render the actual chart & get its configuration. */
            const config = await designer.run(campaign, chart);

            chart.setConfig({
                ...config,
                
                options: {
                    plugins: {
                        legend: { position: "top" }
                    }
                },
                
                type: designer.type
            });

            final.push({
                name: designer.name,
                data: await chart.toBinary()
            });
        }

        return final;
    }

    public async handleInteraction(options: InteractionHandlerRunOptions<ButtonInteraction, CampaignInteractionHandlerData>): InteractionHandlerResponse {
        const action = options.data.action;
        
        if (action === "link") {
            const { db, raw } = options;

            const campaign: DatabaseCampaign | null = await this.get(raw[1]);
            if (campaign === null) return;

            /* Increment the campaign's clicks. */
            await this.increment(campaign, "clicks", db);

            const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder();

            const url: string = this.url({ campaign, db });
            const domain: string = new URL(campaign.link).hostname;

            row.addComponents(
                new ButtonBuilder()
                    .setURL(url).setLabel(domain)
                    .setStyle(ButtonStyle.Link)
            );

            return new Response()
                .addComponent(ActionRowBuilder<ButtonBuilder>, row)
                .setEphemeral(true);
            
        } else if (action === "ui") {
            const command: CampaignsCommand = this.db.bot.command.get("campaigns");
            return await command.handleInteraction(options);
        }
    }

    public url({ campaign, db }: CampaignRenderOptions): string {
        return `https://l.turing.sh/${campaign.id}/${db.user.id}`;
    }
}

export class AppCampaignManager extends BaseCampaignManager<AppDatabaseManager> {
    /* List of all campaigns */
    public campaigns: DatabaseCampaign[];

    constructor(db: AppDatabaseManager) {
        super(db);
        this.campaigns = [];
    }

    /**
     * Fetch all campaigns from the database.
     */
    public async load(): Promise<DatabaseCampaign[]> {
        if (this.campaigns.length > 0) this.campaigns = [];

        const { data, error } = await this.db.client.from(this.collectionName())
            .select("*");

        if (error !== null) throw new GPTDatabaseError({
            collection: "campaigns", raw: error
        });

        /* If no campaigns were found, return nothing. */
        if (data === null || data.length === 0) return [];

        /* List of campaigns */
        const campaigns: DatabaseCampaign[] = data as DatabaseCampaign[];

        if (this.db.bot.dev) this.db.bot.logger.debug(`Loaded`, chalk.bold(campaigns.length), `campaign${campaigns.length > 1 ? "s" : ""} from the database.`);
        this.campaigns = campaigns;

        this.campaigns.forEach(c => this.db.setCache("campaigns", c.id, c));
        return campaigns;
    }

    public async setup(): Promise<void> {
        await this.load();
    }

    private collectionName(): string {
        return this.db.collectionName("campaigns");
    }
}