import { Awaitable, Snowflake, User } from "discord.js";
import { randomUUID } from "crypto";

import { DatabaseInfraction, DatabaseInfractionOptions } from "../../moderation/types/infraction.js";
import { DatabaseGuild, DatabaseGuildSubscription } from "./guild.js";
import { SettingsLocation } from "../managers/settings.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabasePlan } from "../managers/plan.js";
import { VoteDuration } from "../../util/vote.js";
import { UserRoles } from "../managers/role.js";
import { DatabaseSchema } from "./schema.js";

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
    infractions: DatabaseInfraction[];

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
        user.interactions = this.interactions(user);

        user.infractions = user.infractions.map(
            i => !i.id ? ({ ...i, id: randomUUID().slice(undefined, 8) }) : i
        );

        return user;
    }

    public template(id: string): Awaitable<DatabaseUser> {
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

    public voted(user: DatabaseUser): number | null {
        if (user.voted === null) return null;

        const parsed: number = Date.parse(user.voted);
        if (Date.now() - parsed > VoteDuration) return null;

        return parsed;
    }
}