import { Awaitable } from "discord.js";
import chalk from "chalk";

import { ModerationOptions, ModerationResult, ModerationSource } from "../moderation.js";
import { ModerationFilter, ModerationFilters } from "./filters.js";
import { DatabaseInfraction } from "../types/infraction.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { DatabaseUser } from "../../db/schemas/user.js";
import { Bot } from "../../bot/bot.js";

export interface ModerationFilterOptions {
    description: string;
}

export interface ModerationFilterData {
    bot: Bot;
    content: string;
    db: DatabaseInfo;
    source: ModerationSource;
}

/* Which action to perform regarding the flagged content */
export type ModerationFilterActionType = "ban" | "warn" | "block" | "flag"

export type ModerationFilterAction = Pick<DatabaseInfraction, "reason"> & {
    /* Which action to perform */
    type: ModerationFilterActionType;
}

export type ModerationFilterActionData = ModerationFilterAction & {
    /* Which moderation action was performed */
    action: string;
}

export interface ModerationFilterWord {
    /* Words to block */
    words: (string | RegExp)[]; 

    /* White-listed words */
    allowed?: (string | RegExp)[];

    /* Which infraction to execute for this flagged word */
    action?: Partial<ModerationFilterAction>;
}

export type ModerationFilterWordOptions = Omit<ModerationFilterOptions, "filter"> & {
    /* Words to block */
    blocked: ModerationFilterWord[];

    /* Generic action to run, if no other was specified */
    action: ModerationFilterAction;
}

export type ModerationFilterCallback = (data: ModerationFilterAction, action: ModerationFilter) => boolean;

export class FilterManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public async filter(options: ModerationFilterData): Promise<ModerationFilterActionData | null> {
        /* Exempt all owners from the moderation filters. */
        if (this.bot.db.role.owner(options.db.user)) return null;

        /* Which action was performedm, if any */
        let flagged: { data: ModerationFilterAction, action: ModerationFilter } | null = null;

        for (const filter of ModerationFilters) {
            /* Execute the filter. */
            try {
                const result = await filter.execute(options);

                if (result !== null) {
                    flagged = { data: result, action: filter };
                    break;
                }

            /* If an error occurred, simply continue with the next filter. */
            } catch (error) {
                this.bot.logger.warn("Failed to execute moderation filter", chalk.bold(filter.description), "->", error); 
            }
        }

        /* If no filter was triggered, return nothing. */
        if (flagged === null) return null;

        return {
            ...flagged.data,
            action: flagged.action.description
        };
    }

    public async execute({ auto, db }: ModerationOptions & { auto: ModerationFilterActionData, result: ModerationResult }): Promise<DatabaseUser> {
        if (auto.type === "ban") {
            return await this.bot.moderation.ban(db.user, { status: true, reason: auto.reason });

        } else if (auto.type === "warn") {
            return await this.bot.moderation.warn(db.user, { reason: auto.reason });
        }

        return db.user;
    }
}