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

    /* How long to ban the entry for, if applicable */
    duration?: number;
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

    public get(id: string): ModerationFilter | null {
        return ModerationFilters.find(f => f.id === id) ?? null;
    }

    public async filter(options: ModerationFilterData): Promise<ModerationFilterActionData | null> {
        /* Exempt all owners from the moderation filters. */
        //if (this.bot.db.role.owner(options.db.user)) return null;

        /* Which action was performedm, if any */
        let flagged: { data: ModerationFilterAction, action: ModerationFilter } | null = null;

        for (const filter of ModerationFilters) {
            try {
                /* Execute the filter. */
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

        if (flagged === null) return null;
        if (flagged.data.type !== "ban" && flagged.data.duration) delete flagged.data.duration;

        return {
            ...flagged.data, action: flagged.action.id
        };
    }

    public async execute({ auto, db, reference }: ModerationOptions & { auto: ModerationFilterActionData, result: ModerationResult, reference: DatabaseInfraction | null }): Promise<DatabaseInfraction | null> {
        let updated: DatabaseUser = null!;

        const base: Partial<DatabaseInfraction> = {
            reason: auto.reason, reference: reference ? {
                type: "infraction", data: reference.id
            } : undefined
        };

        if (auto.type === "ban") {
            updated = await this.bot.moderation.ban(db.user, {
                ...base, status: true, duration: auto.duration
            });

        } else if (auto.type === "warn") {
            updated = await this.bot.moderation.warn(db.user, base);
        }

        if (updated === null || updated.infractions.length === db.user.infractions.length) return null;
        return updated.infractions[updated.infractions.length - 1];
    }
}