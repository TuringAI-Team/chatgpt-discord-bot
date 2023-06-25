import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ColorResolvable, EmbedBuilder, Snowflake } from "discord.js";
import { randomUUID } from "crypto";
import chalk from "chalk";
import { URL } from "url";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../../interaction/handler.js";
import { CampaignInteractionHandlerData } from "../../interactions/campaign.js";
import { DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { GPTDatabaseError } from "../../error/gpt/db.js";
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
    budget: number | null;

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

export interface DisplayCampaignResponse {
    embed: EmbedBuilder;
    row: ActionRowBuilder<ButtonBuilder>;
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

type CampaignRenderOptions = Pick<CampaignPickOptions, "db"> & { campaign: DatabaseCampaign }
type CampaignRunFilterOptions = Pick<CampaignPickOptions, "db"> & { campaign: DatabaseCampaign }

export class BaseCampaignManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {
    
}

export class ClusterCampaignManager extends BaseCampaignManager<ClusterDatabaseManager> {
    /**
     * Get all available campaigns.
     * @returns Available campaigns
     */
    private async all(): Promise<DatabaseCampaign[]> {
        return await this.db.eval(async app => {
            return app.db.campaign.campaigns;
        });
    }
    public async get(id: string): Promise<DatabaseCampaign | null> {
        return await this.db.fetchFromCacheOrDatabase<string, DatabaseCampaign>(
			"campaigns", id
		);
    }

    public async pick({ db }: Omit<CampaignPickOptions, "count">): Promise<DatabaseCampaign | null> {
        const sorted: DatabaseCampaign[] = (await this.all())
            .filter(c => c.active && this.executeFilters({ campaign: c, db }))
            .sort((a, b) => (a.budget ?? 0) - (b.budget ?? 0));

        return sorted[0];
    }

	/**
	 * Choose an ad from the available list, to display in the bot's response.
	 */
	public async ad(options: Pick<CampaignPickOptions, "db">): Promise<DisplayCampaign | null> {
		const campaign: DatabaseCampaign | null = await this.pick(options);
		if (campaign === null) return null;

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

    public async render({ campaign }: CampaignRenderOptions): Promise<DisplayCampaign> {
        const row: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder();
        const embed: EmbedBuilder = new EmbedBuilder();

        embed.setTitle(campaign.settings.title);
        embed.setDescription(campaign.settings.description);
        embed.setColor(campaign.settings.color ?? this.db.config.branding.color);
        if (campaign.settings.image) embed.setImage(campaign.settings.image);
        if (campaign.settings.thumbnail) embed.setThumbnail(campaign.settings.thumbnail);
        embed.setFooter({ text: "This is a sponsored advertisement." });

		/* If the message has any additional buttons attached, add them to the resulting message. */
		if (campaign.settings.buttons && campaign.settings.buttons.length > 0) {
			const buttons: ButtonBuilder[] = [];

			campaign.settings.buttons.forEach(button => {
				const builder = new ButtonBuilder()

                if (button.emoji) builder.setEmoji(button.emoji);
                builder.setLabel(button.label);

                if (button.id === "campaign") {
                    builder.setCustomId(`campaign:${campaign.id}:link`);
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
		}

        return {
            db: campaign, response: {
                embed, row
            }
        };
    }

    public async handleInteraction({ db, data: { action, id } }: InteractionHandlerRunOptions<ButtonInteraction, CampaignInteractionHandlerData>): InteractionHandlerResponse {
        const campaign: DatabaseCampaign | null = await this.get(id);
        if (campaign === null) return;

        if (action === "link") {
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
        }
    }

    public url({ campaign, db }: CampaignRenderOptions): string {
        return `https://l.turing.sh/${campaign.name}/${db.user.id}`;
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

        return campaigns;
    }

    public async setup(): Promise<void> {
        await this.load();
    }

    private collectionName(): string {
        return this.db.collectionName("campaigns");
    }
}