import { Awaitable, Guild, Snowflake } from "discord.js";

import { DatabaseInfraction } from "../../moderation/types/infraction.js";
import { DatabaseSettings, DatabaseSubscription } from "./user.js";
import { SettingsLocation } from "../managers/settings.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabasePlan } from "../managers/plan.js";
import { DatabaseSchema } from "./schema.js";

export type DatabaseGuildMetadataKey = "category"
export const DatabaseGuildMetadataKeys: DatabaseGuildMetadataKey[] = [ "category" ]
export type DatabaseGuildMetadata = Record<DatabaseGuildMetadataKey, string | undefined>

export type DatabaseGuildSubscription = DatabaseSubscription & {
    /* Who redeemed the subscription key for the server */
    by: Snowflake;
}

export interface DatabaseGuild {
    /* Identifier of the Discord guild */
    id: Snowflake;

    /* When the guild was added to the database */
    created: string;

    /* The guild's configured settings */
    settings: DatabaseSettings;

    /* The guild's infractions */
    infractions: DatabaseInfraction[];

    /* The guilds's metadata */
    metadata: DatabaseGuildMetadata;

    /* Information about the guild's subscription */
    subscription: DatabaseGuildSubscription | null;

    /* Information bout the guild's pay-as-you-go plan */
    plan: DatabasePlan | null;
}

export class GuildSchema extends DatabaseSchema<DatabaseGuild, Guild> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "guilds"
        });
    }

    public async process(guild: DatabaseGuild): Promise<DatabaseGuild> {
        guild.plan = this.db.plan.active(guild) ? this.db.plan.get(guild) : null;
        guild.subscription = this.db.schema("users").subscription(guild);

        guild.settings = this.db.settings.load(guild);
        guild.metadata = this.metadata(guild);

        return guild;
    }

    public metadata(entry: DatabaseGuild): DatabaseGuildMetadata {
        const final: Partial<DatabaseGuildMetadata> = {};

        for (const key of DatabaseGuildMetadataKeys) {
            final[key] = entry.metadata !== null ? entry.metadata[key] : undefined;
        }

        return final as DatabaseGuildMetadata;
    }

    public metadataTemplate(): DatabaseGuildMetadata {
        const final: Partial<DatabaseGuildMetadata> = {};

        for (const key of DatabaseGuildMetadataKeys) {
            final[key] = undefined;
        }

        return final as DatabaseGuildMetadata;
    }

    public template(id: string): Awaitable<DatabaseGuild> {
        return {
            id,
            created: new Date().toISOString(),
            subscription: null, plan: null,
            settings: this.db.settings.template(SettingsLocation.Guild),
            metadata: this.metadataTemplate(),
            infractions: []
        };
    }
}