import type { ActionRow, Embed } from "discordeno";

import type { EmbedColor } from "../../bot/utils/response.js";

interface DBCampaignSettings {
    /** Title of the campaign, to display in the embed */
    title: string;

    /** Description of the campaign, to display in the embed */
    description: string;

    /** Color of the embed, optional */
    color?: keyof typeof EmbedColor;

    /** Image of the embed, optional */
    image?: string;

    /** Thumbnail of the embed, optional */
    thumbnail?: string;
}

interface DBCampaignStatistics {
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

export type DBCampaignBudgetType = "click" | "view" | "none"

export interface DBCampaignBudget {
    /** The total budget of the campaign */
    total: number;

    /** How much has already been used */
    used: number;

    /** Whether cost should be per-view or per-click */
    type: DBCampaignBudgetType;

    /** CPM - Cost per thousand clicks or views, depending on the type */
    cost: number;
}

export interface DBCampaign {
    /** Unique identifier of the campaign */
    id: string;

    /** Name of the campaign */
    name: string;

    /** When the campaign was created */
    created: string;

    /** Whether the campaign is active */
    active: boolean;

    /** What the budget of this campaign is */
    budget: DBCampaignBudget;

    /** Discord IDs of the members of this campaign */
    members: string[];

    /** Link to the the campaign's target site */
    link: string;

    /** Settings of the campaign, used for storing title, description, etc. */
    settings: DBCampaignSettings;

    /** Statistics of the campaign, e.g. how many clicks */
    stats: DBCampaignStatistics;
}

export interface CampaignRender {
	row: ActionRow;
    embed: Embed;
}

export interface CampaignDisplay {
	response: CampaignRender;
    campaign: DBCampaign;
}