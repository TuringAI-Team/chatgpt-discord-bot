import { Snowflake } from "discord.js";

import { ModerationResult, ModerationSource } from "../moderation.js";

export type DatabaseUserInfractionType = "ban" | "unban" | "warn" | "moderation"

export type DatabaseInfractionReferenceType = ModerationSource

export interface DatabaseInfractionReference {
    type: DatabaseInfractionReferenceType;
    content: string;
}

export interface DatabaseInfraction {
    /** Type of moderation action */
    type: DatabaseUserInfractionType;

    /** ID of the infraction */
    id: string;

    /** When this action was taken */
    when: number;

    /** Which bot moderator took this action, Discord identifier */
    by?: Snowflake;

    /** Why this action was taken */
    reason?: string;

    /** Whether the user has seen this infraction */
    seen?: boolean;

    /** How long this infraction lasts, e.g. for bans */
    until?: number;

    /** References for this infraction */
    references?: DatabaseInfractionReference[];

    /** Used for `moderation` infractions */
    moderation?: ModerationResult;
}

export type DatabaseInfractionOptions = Pick<DatabaseInfraction, "by" | "reason" | "type" | "moderation" | "seen" | "references" | "until">