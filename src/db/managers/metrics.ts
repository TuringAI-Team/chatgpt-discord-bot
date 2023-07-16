import { randomUUID } from "crypto";

import { DatabaseCollectionType, DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { MentionType } from "../../conversation/generator.js";
import { BotClusterManager } from "../../bot/manager.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { GPTDatabaseError } from "../../error/db.js";
import { AppDatabaseManager } from "../app.js";
import { SubDatabaseManager } from "../sub.js";

type MetricsUpdateValue = `+${string | number}` | `-${string | number}` | string | number | Object
type MetricsUpdateObject<T extends MetricsEntry> = Record<keyof T["data"], MetricsUpdateValue>

type MetricsData = { [key: string]: any }
export type MetricsType = "cooldown" | "guilds" | "users" | "chat" | "premium" | "vote" | "image" | "commands"

interface MetricsEntry<T extends MetricsType = MetricsType, U extends MetricsData = MetricsData> {
    /* Type of metric */
    type: T;

    /* When this metric data was saved */
    time: string;

    /* The actual data, varies from type to type */
    data: U;
}

type DatabaseMetricsEntry<T extends MetricsType = MetricsType, U extends MetricsData = MetricsData> = MetricsEntry<T, U> & {
    id: string;
}

type CooldownMetricsEntry = MetricsEntry<"cooldown", {
    /* A cool-down entry for each command */
    [key: string]: number;

    /* Cool-down for chat messages */
    chat: number;
}>

type GuildsMetricsEntry = MetricsEntry<"cooldown", {
    /* To how many servers the bot was added */
    joins: number;

    /* How many servers removed the bot */
    leaves: number;

    /* How many servers the bot is in, in total */
    total: number;
}>

interface UserMetric {
    /* New users for this time frame */
    additional: number;

    /* Total amount of users now */
    total: number;
}

type UsersMetricsEntry = MetricsEntry<"users", {
    discord: UserMetric;
    db: UserMetric;
}>

type ChatMetricsEntry = MetricsEntry<"chat", {
    models: {
        [key: string]: number;
    };

    tones: {
        [key: string]: number;
    };

    tokens: {
        prompt: Record<string, number>;
        completion: Record<string, number>;
    };

    sources: Record<MentionType, number>;
}>

type PremiumMetricsEntry = MetricsEntry<"premium", {
    location: {
        user: number;
        guild: number;
    };

    type: {
        plan: number;
        credits: number;
    };
}>

type VoteMetricsEntry = MetricsEntry<"vote", {
    count: number;
}>

type ImageMetricsEntry = MetricsEntry<"image", {
    counts: {
        [key: number]: number;
    };

    steps: {
        [key: number]: number;
    };

    styles: {
        [key: string]: number;
    };

    ratios: {
        [key: string]: number;
    }

    samplers: {
        [key: string]: number;
    }

    models: {
        [key: string]: number;
    };
}>

type CommandsMetricsEntry = MetricsEntry<"commands", {
    [key: string]: number;
}>

export class DatabaseMetricsManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {}

export class ClusterDatabaseMetricsManager extends DatabaseMetricsManager<ClusterDatabaseManager> {
    public changeGuildsMetric(updates: Partial<MetricsUpdateObject<GuildsMetricsEntry>>): Promise<GuildsMetricsEntry["data"]> {
        return this.change("guilds", updates);
    }

    public changeUsersMetric(updates: Partial<MetricsUpdateObject<UsersMetricsEntry>>): Promise<UsersMetricsEntry["data"]> {
        return this.change("users", updates);
    }

    public changeCooldownMetric(updates: Partial<MetricsUpdateObject<CooldownMetricsEntry>>): Promise<CooldownMetricsEntry["data"]> {
        return this.change("cooldown", updates);
    }

    public changeChatMetric(updates: Partial<MetricsUpdateObject<ChatMetricsEntry>>): Promise<ChatMetricsEntry["data"]> {
        return this.change("chat", updates);
    }

    public changePremiumMetric(updates: Partial<MetricsUpdateObject<PremiumMetricsEntry>>): Promise<PremiumMetricsEntry["data"]> {
        return this.change("premium", updates);
    }

    public changeVoteMetric(updates: Partial<MetricsUpdateObject<VoteMetricsEntry>>): Promise<VoteMetricsEntry["data"]> {
        return this.change("vote", updates);
    }

    public changeImageMetric(updates: Partial<MetricsUpdateObject<ImageMetricsEntry>>): Promise<ImageMetricsEntry["data"]> {
        return this.change("image", updates);
    }

    public changeCommandsMetric(updates: Partial<MetricsUpdateObject<CommandsMetricsEntry>>): Promise<CommandsMetricsEntry["data"]> {
        return this.change("commands", updates);
    }

    private async change<T extends MetricsEntry>(
        type: MetricsType, updates: Partial<MetricsUpdateObject<T>>
    ): Promise<T["data"]> {
        const result: T["data"] = await this.db.bot.client.cluster.evalOnManager(((manager: BotClusterManager, context: { type: MetricsType, updates: MetricsUpdateObject<T> }) =>
            manager.bot.app.db.metrics.change(context.type, context.updates)
        ) as any, {
            context: { type, updates }
        });

        return result;
    }

    public async save(): Promise<void> {
        await this.db.bot.client.cluster.evalOnManager((async (manager: BotClusterManager) =>
            await manager.bot.app.db.metrics.save()
        ) as any);
    }

    public async pending(): Promise<Pick<MetricsEntry, "type" | "data">[]> {
        const entries = await this.db.bot.client.cluster.evalOnManager(((manager: BotClusterManager) =>
            Array.from(manager.bot.app.db.metrics.pending.entries())
        ) as any);

        return entries.map(([ type, data ]) => ({
            type, data
        }));
    }

    public async lastResetAt(): Promise<number | null> {
        return (await this.db.bot.client.cluster.evalOnManager(((manager: BotClusterManager) =>
            manager.bot.app.db.metrics.lastResetAt
        ) as any)) as unknown as number;
    }
}

export class AppDatabaseMetricsManager extends DatabaseMetricsManager<AppDatabaseManager> {
    /* Pending metric entries */
    public readonly pending: Map<MetricsType, MetricsData>;

    /* Last time when the metrics got reset */
    public lastResetAt: number | null;

    constructor(db: AppDatabaseManager) {
        super(db);

        this.pending = new Map();
        this.lastResetAt = null;
    }

    /**
     * Calculate/transform the given value for a metric.
     * 
     * @param type Type of metric
     * @param key Which key this value is for
     * @param existing The existing metric, if available
     * 
     * @returns New value for the key
     */
    private newValue<T extends MetricsType, U extends MetricsEntry>(
        type: T, key: keyof U["data"], value: MetricsUpdateValue, existing: U["data"] | null
    ): Object | string | number {
        if (typeof value === "string") {
            if ([ "+", "-" ].includes(value.slice(undefined, 1))) {
                /* Previous number value for this metric */
                const previousValue: number = existing !== null && existing[key] != undefined ? parseFloat(existing[key].toString()) : 0;

                const operator: "+" | "-" = value.slice(undefined, 1) as any;
                const newNumber: string = value.slice(1);

                const updated: number = eval(`${previousValue} ${operator} ${newNumber}`);
                return updated;
            }

            return value;

        } else if (typeof value === "number") {
            return value;

        } else if (typeof value === "object") {
            const newObject: any = existing !== null && existing[key] != undefined ? existing[key] : {};

            for (const [ objectKey, objectValue ] of Object.entries(value)) {
                newObject[objectKey] = this.newValue(
                    type, objectKey, objectValue, newObject
                );
            }

            return newObject;
        }

        throw new Error("This shouldn't happen");
    }

    public change<T extends MetricsEntry>(
        type: MetricsType, updates: Partial<MetricsUpdateObject<T>>
    ): T["data"] {
        /* Existing metrics entry for this time frame */
        const existing: MetricsData | null = this.pending.get(type) ?? null;
        const updated: Partial<MetricsData> = existing ?? {};

        for (const [ key, updatedValue ] of Object.entries(updates)) {
            /* The new, formatted metric value */
            const newValue = this.newValue(type, key, updatedValue!, existing);
            updated[key] = newValue;
        }

        this.pending.set(type, updated);
        return updated;
    }

    /**
     * Save all queued metrics to the database.
     */
    public async save(): Promise<void> {
        /* If metrics are disabled, don't save them. */
        if (!this.db.bot.config.metrics) return;

        /* All new metric entries */
        const entries: DatabaseMetricsEntry[] = [];

        for (const [ key, data ] of this.pending.entries()) {
            entries.push({
                type: key, time: new Date().toISOString(),
                data, id: randomUUID()
            });
        }

        /* Insert the updated metric entries into the collection. */
        const { error } = await this.db.client
            .from("metrics")
            .insert(entries);

        if (error) {
            this.db.bot.logger.error("Failed to save metrics ->", error.message);
            throw new GPTDatabaseError({ collection: "metrics" as DatabaseCollectionType, raw: error });
        } else {
            /* Clear the previous metrics now. */
            this.lastResetAt = Date.now();
            this.pending.clear();
        }
    }
}