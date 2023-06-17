import { Awaitable, Guild, Snowflake } from "discord.js";

import { DatabaseSettings, DatabaseSubscription } from "./user.js";
import { type AppDatabaseManager } from "../app.js";
import { DatabasePlan } from "../managers/plan.js";
import { DatabaseSchema } from "./schema.js";

export type DatabaseGuildSubscription = DatabaseSubscription & {
    /* Who redeemed the subscription key for the server */
    by: Snowflake;
}

export interface DatabaseGuild {
    /* Identifier of the Discord guild */
    id: Snowflake;

    /* When the guild was added to the database */
    created: string;

    /* Information about the guild's subscription */
    subscription: DatabaseGuildSubscription | null;

    /* The guild's configured settings */
    settings: DatabaseSettings;

    /* Information bout the guild's pay-as-you-go plan */
    plan: DatabasePlan | null;
}

export class GuildSchema extends DatabaseSchema<DatabaseGuild, Guild> {
    constructor(db: AppDatabaseManager) {
        super(db, {
            collection: "guilds"
        });
    }

    public async process(guild: DatabaseGuild): Promise<DatabaseGuild | null> {
        /*guild.plan = this.db.plan.active(guild) ? this.db.plan.get(guild) : null;
        guild.subscription = this.subscription(guild);

        guild.settings = this.db.settings.load(guild);*/

        return guild;
    }

    public template(id: string, source: Guild): Awaitable<DatabaseGuild> {
        return {
            id: source.id,
            created: new Date().toISOString(),
            subscription: null, plan: null,
            settings: {}, // this.db.settings.template(SettingsLocation.Guild)
        };
    }
}