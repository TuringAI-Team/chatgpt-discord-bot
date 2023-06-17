import { ColorResolvable, Snowflake } from "discord.js";

import { SubClusterDatabaseManager } from "../sub.js";

interface DatabaseCampaignSettings {
    /** Title of the campaign, to display in the embed */
    title: string;

    /** Description of the campaign, to display in the embed */
    description: string;

    /** Color of the embed, optional */
    color?: ColorResolvable;

    /** Image of the embed, optional */
    image?: string;
}

interface DatabaseCampaignStatistics {
    clicks: {
        /** Total amount of clicks to this campaign */
        total: number;

        /** Geo-specific clicks */
        geo: Record<string, number>;

        /** Unique user clicks, IDs */
        unique: Snowflake[];
    };
}

type DatabaseCampaignFilterData = string | (string | number)[] | any

interface DatabaseCampaignFilterCall<T extends DatabaseCampaignFilterData = any> {
    /** Which filter to use */
    name: string;

    /** Data to pass to the filter */
    data: T;
}

interface DatabaseCampaign {
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
    filters: DatabaseCampaignFilterCall[];

    /** Link to the the campaign's target site */
    link: string;

    /** Settings of the campaign, used for storing title, description, etc. */
    settings: DatabaseCampaignSettings;

    /** Statistics of the campaign, e.g. how many clicks */
    stats: DatabaseCampaignStatistics;
}

/*
EXAMPLE CAMPAIGN:

const example: DatabaseCampaign = {
    id: "2687d093-f5f3-4e23-857d-2dc3de602fcc",
    name: "topgg",
    created: "2023-05-13 08:58:23.719312+00",
    active: true,
    budget: 100,
    members: [],
    filters: [],
    link: "https://top.gg/bot/1053015370115588147/vote",
    settings: {
        title: "Vote for the bot & get rewards 📩",
        description: "By voting for our bot on **top.gg** using the link below, you'll get a **way lower** cool-down for **ChatGPT** & **many other commands**."
    },
    stats: {
        clicks: {
            total: 117,
            geo: {
                Germany: 110,
                Spain: 7
            },
            unique: [
                "747682664135524403",
                "530102778408861706"
            ]
        }
    }
}
*/

export class CampaignManager extends SubClusterDatabaseManager {

}