import { Awaitable } from "discord.js";
import chalk from "chalk";

import { DatabaseUserInfraction, DatabaseUserInfractionType } from "../../db/schemas/user.js";
import { AutoModerationFilter, AutoModerationFilters } from "./filters.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { ModerationSource } from "../moderation.js";
import { Bot } from "../../bot/bot.js";

export interface AutoModerationFilterOptions {
    description: string;
    filter?: (options: AutoModerationFilterData) => Awaitable<AutoModerationAction | null>;
}

export interface AutoModerationFilterData {
    bot: Bot;
    content: string;
    db: DatabaseInfo;
    source: ModerationSource;
    filterCallback?: AutoModerationFilterCallback;
}

/* Which action to perform regarding the flagged content */
export type AutoModerationActionType = DatabaseUserInfractionType | "block" | "flag"

export type AutoModerationAction = Pick<DatabaseUserInfraction, "reason"> & {
    /* Which action to perform */
    type: AutoModerationActionType;
}

export type AutoModerationActionData = AutoModerationAction & {
    /* Which AutoMod action was performed */
    action: string;
}

export interface AutoModerationWord {
    /* Words to block */
    words: (string | RegExp)[]; 

    /* White-listed words */
    allowed?: (string | RegExp)[];

    /* Which infraction to execute for this flagged word */
    action?: Partial<AutoModerationAction>;
}

export type AutoModerationWordFilterOptions = Omit<AutoModerationFilterOptions, "filter"> & {
    /* Words to block */
    blocked: AutoModerationWord[];

    /* Generic action to run, if no other was specified */
    action: AutoModerationAction;
}

export type AutoModerationFilterCallback = (data: AutoModerationAction, action: AutoModerationFilter) => boolean;

export class AutoModerationManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public async execute(options: AutoModerationFilterData): Promise<AutoModerationActionData | null> {
        /* Which action was performedm, if any */
        let flagged: { data: AutoModerationAction, action: AutoModerationFilter } | null = null;

        for (const filter of AutoModerationFilters) {
            /* Execute the filter. */
            try {
                const result = await filter.execute(options);

                if (result !== null) {
                    /* If this filter should be skipped, do so. */
                    if (options.filterCallback && options.filterCallback(result, filter)) continue;

                    flagged = { data: result, action: filter };
                    break;
                }

            /* If an error occurred, simply continue with the next filter. */
            } catch (error) {
                this.bot.logger.warn(`Failed to execute moderation filter ${chalk.bold(filter.description)} ->`, error); 
            }
        }

        /* If no filter was triggered, return nothing. */
        if (flagged === null) return null;

        return {
            ...flagged.data,
            action: flagged.action.description
        };
    }
}