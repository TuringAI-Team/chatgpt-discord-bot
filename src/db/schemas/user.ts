import { Awaitable, Snowflake, User } from "discord.js";

import { DatabaseModerationResult } from "../../moderation/moderation.js";
import { SettingsLocation } from "../managers/settings.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabasePlan } from "../managers/plan.js";
import { VoteDuration } from "../../util/vote.js";
import { UserRoles } from "../managers/role.js";
import { DatabaseSchema } from "./schema.js";
import { DatabaseGuild, DatabaseGuildSubscription } from "./guild.js";

export type DatabaseSubscriptionType = "guild" | "user"

export type DatabaseSettings = Record<string, any>

export interface DatabaseSubscription {
    /* Since when the user has an active subscription */
    since: number;

    /* When this premium subscription expires */
    expires: number;
}

export type UserSubscriptionPlanType = "plan" | "subscription" | "voter" | "free"
export type UserSubscriptionLocation = "guild" | "user"

export interface UserSubscriptionType {
    type: UserSubscriptionPlanType;
    location: UserSubscriptionLocation;
    premium: boolean;
}

export interface DatabaseUser {
    /* Discord ID of the user */
    id: Snowflake;

    /* When the user first interacted with the bot */
    created: string;

    /* How many interactions the user has with the bot */
    interactions: DatabaseInteractionStatistics;

    /* Moderation history of the user */
    infractions: DatabaseUserInfraction[];

    /* Information about the user's subscription */
    subscription: DatabaseSubscription | null;

    /* Information about the user's pay-as-you-go plan */
    plan: DatabasePlan | null;

    /* When the user voted for the bot */
    voted: string | null;

    /* The user's configured settings */
    settings: DatabaseSettings;

    /* The user's metadata */
    metadata: DatabaseUserMetadata;

    /* The user's roles */
    roles: UserRoles;
}

export type DatabaseUserMetadataKey = "country" | "region" | "email"
export const DatabaseUserMetadataKeys: DatabaseUserMetadataKey[] = [ "country", "region", "email" ]
export type DatabaseUserMetadata = Record<DatabaseUserMetadataKey, string | undefined>

export type DatabaseInteractionType = "commands" | "interactions" | "images" | "messages" | "resets" | "translations" | "imageDescriptions" | "cooldownMessages" | "videos" | "songs"
export const DatabaseInteractionTypes: DatabaseInteractionType[] = [ "commands", "interactions", "images", "messages", "resets", "translations", "imageDescriptions", "cooldownMessages", "videos" ]
export type DatabaseInteractionStatistics = Record<DatabaseInteractionType, number>

/* Type of moderation action */
export type DatabaseUserInfractionType = "ban" | "unban" | "warn" | "moderation"

export interface DatabaseUserInfraction {
    /* Type of moderation action */
    type: DatabaseUserInfractionType;

    /* When this action was taken */
    when: number;

    /* Which bot moderator took this action, Discord identifier */
    by?: Snowflake;

    /* Why this action was taken */
    reason?: string;

    /* Whether the user has been notified of this infraction */
    seen?: boolean;

    /* Used for `moderation` infractions */
    moderation?: DatabaseModerationResult;
    automatic?: boolean;
}

export type DatabaseInfractionOptions = Pick<DatabaseUserInfraction, "by" | "reason" | "type" | "moderation" | "automatic" | "seen">

export class UserSchema extends DatabaseSchema<DatabaseUser, User> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "users"
        });
    }

    public async process(user: DatabaseUser): Promise<DatabaseUser | null> {
        user.plan = this.db.plan.active(user) ? this.db.plan.get(user) : null;
        user.subscription = this.subscription(user);

        user.settings = this.db.settings.load(user);
        user.metadata = this.metadata(user);

        return user;
    }

    public template(id: string, source: User): Awaitable<DatabaseUser> {
        return {
            id,
            created: new Date().toISOString(),
            interactions: this.interactionsTemplate(),
            subscription: null, plan: null, voted: null,
            settings: this.db.settings.template(SettingsLocation.User),
            metadata: this.metadataTemplate(),
            infractions: [],
            roles: []
        };
    }

    public metadata(entry: DatabaseUser): DatabaseUserMetadata {
        const final: Partial<DatabaseUserMetadata> = {};

        for (const key of DatabaseUserMetadataKeys) {
            final[key] = entry.metadata !== null ? entry.metadata[key] : undefined;
        }

        return final as DatabaseUserMetadata;
    }

    public metadataTemplate(): DatabaseUserMetadata {
        const final: Partial<DatabaseUserMetadata> = {};

        for (const key of DatabaseUserMetadataKeys) {
            final[key] = undefined;
        }

        return final as DatabaseUserMetadata;
    }

    public interactions(entry: DatabaseUser): DatabaseInteractionStatistics {
        const interactions: Partial<DatabaseInteractionStatistics> = {};

        for (const key of DatabaseInteractionTypes) {
            interactions[key] = entry.interactions ? entry.interactions[key] ?? 0 : 0;
        }

        return interactions as DatabaseInteractionStatistics;
    }

    public interactionsTemplate(): DatabaseInteractionStatistics {
        const interactions: Partial<DatabaseInteractionStatistics> = {};

        for (const key of DatabaseInteractionTypes) {
            interactions[key] = 0;
        }

        return interactions as DatabaseInteractionStatistics;
    }

    /**
     * Get information about the user/guild's current subscription, if available.
     * @param db User/guild to get subscription for
     * 
     * @returns User/guild's current subscription, if available
     */
    public subscription<T extends DatabaseGuildSubscription | DatabaseSubscription>(db: DatabaseUser | DatabaseGuild): T | null {
        if (db.subscription === null) return null;
        if (db.subscription !== null && Date.now() > db.subscription.expires) return null;

        return {
            ...db.subscription as T,
            
            /* Handle an edge case where `since` and `expires` are actually a date string instead of a UNIX timestamp. */
            since: typeof db.subscription.since === "string" ? Date.parse(db.subscription.since) : db.subscription.since,
            expires: typeof db.subscription.expires === "string" ? Date.parse(db.subscription.expires) : db.subscription.expires
        };
    }

    /**
     * Check whether the specified user is banned.
     * @param user User to check
     * 
     * @returns Whether they are banned
     */
    public banned(user: DatabaseUser): DatabaseUserInfraction | null {
        /* List of all ban-related infractions */
        const infractions: DatabaseUserInfraction[] = user.infractions.filter(i => i.type === "ban" || i.type === "unban");
        if (infractions.length === 0) return null;

        /* Whether the user is banned; really dumb way of checking it */
        const banned: boolean = infractions.length % 2 > 0;
        return banned ? infractions[infractions.length - 1] : null;
    }

    /**
     * Give an infraction of the specified type to a user.
     * 
     * @param user User to give the infraction to
     * @param options Infraction options
     */
    public async infraction(user: DatabaseUser, { by, reason, type, seen, moderation, automatic }: DatabaseInfractionOptions & { seen?: boolean }): Promise<DatabaseUser> {
        /* Raw infraction data */
        const data: DatabaseUserInfraction = {
            by, reason, type, moderation, automatic,
            when: Date.now()
        };

        if (type !== "moderation" && type !== "ban" && type !== "unban") data.seen = seen ?? false;

        /* Update the user cache too. */
        return this.update(user, {
            infractions: [
                ...(await this.get(user))?.infractions ?? [],
                data
            ]
        });
    }

    public voted(user: DatabaseUser): number | null {
        if (user.voted === null) return null;

        const parsed: number = Date.parse(user.voted);
        if (Date.now() - parsed > VoteDuration) return null;

        return parsed;
    }
}