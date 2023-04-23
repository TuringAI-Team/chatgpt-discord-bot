import { Awaitable } from "discord.js";
import chalk from "chalk";

import { DatabaseInfo, DatabaseUserInfraction, DatabaseUserInfractionType } from "../../../db/managers/user.js";
import { AutoModerationFilter, AutoModerationFilters } from "./filters.js";
import { ModerationSource } from "../../../util/moderation/moderation.js";
import { Conversation } from "../../conversation.js";

export interface AutoModerationFilterOptions {
    description: string;
    filter?: (options: AutoModerationFilterData) => Awaitable<AutoModerationAction | null>;
}

export interface AutoModerationFilterData {
    content: string;
    db: DatabaseInfo;
    conversation: Conversation;
    source: ModerationSource;
    filterCallback?: AutoModerationFilterCallback;
}

/* Which action to perform regarding the flagged content */
type AutoModerationActionType = DatabaseUserInfractionType | "block" | "flag"

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
    words: string[]; 

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

/**
 * Apply all possible moderation filters to a message, and returns a moderation action, if filtered.
 * @param options Data used to determine whether to filter a message
 */
export const executeModerationFilters = async (options: AutoModerationFilterData): Promise<AutoModerationActionData | null> => {
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

        /* If an error occured, simply continue with the next filter. */
        } catch (error) {
            options.conversation.manager.bot.logger.warn(`Failed to execute moderation filter ${chalk.bold(filter.description)} ->`, error); 
        }
    }

    /* If no filter was triggered, return nothing. */
    if (flagged === null) return null;

    return {
        ...flagged.data,
        action: flagged.action.description
    };
}