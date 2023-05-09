import { DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { BotClusterManager } from "../../bot/manager.js";
import { Bot } from "../../bot/bot.js";
import { App } from "../../app.js";

type MetricsData = any[] | { [key: string]: any }
type MetricsType = "cooldown" | "guilds" | "users"

interface MetricsEntry<T extends MetricsType = MetricsType, U extends MetricsData = MetricsData> {
    /* Type of metric */
    type: T;

    /* When this metric data was saved */
    time: string;

    /* The actual data, varies from type to type */
    data: U;
}

type CooldownMetricsEntry = MetricsEntry<"cooldown", {
    /* A cool-down entry for each command */
    [key: string]: number;
}>

type GuildsMetricsEntry = MetricsEntry<"cooldown", {
    /* To how many servers the bot was added */
    joins: number;

    /* How many servers removed the bot */
    leaves: number;
}>

interface UserMetric {
    /* New users for this time frame */
    additional: number;

    /* Total amount of users now */
    total: number;
}

type UsersMetricsEntry = MetricsEntry<"cooldown", {
    discord: UserMetric;
    db: UserMetric;
}>

export class DatabaseMetricsManager<T extends DatabaseManagerBot> {
    protected readonly db: DatabaseManager<T>;

    constructor(db: DatabaseManager<T>) {
        this.db = db;
    }
}

export class ClusterDatabaseMetricsManager extends DatabaseMetricsManager<Bot> {
    constructor(db: DatabaseManager<Bot>) {
        super(db);
    }

    public async save(): Promise<void> {
        await this.db.bot.client.cluster.evalOnManager(((manager: BotClusterManager) =>
            manager.bot.app.db.metrics.save()
        ) as any);
    }
}

export class AppDatabaseMetricsManager extends DatabaseMetricsManager<App> {
    /* Pending metric entries */
    private readonly pending: Map<MetricsType, MetricsEntry>;

    constructor(db: DatabaseManager<App>) {
        super(db);

        this.pending = new Map();
    }

    private change<T extends MetricsEntry>(type: MetricsType, updates: Partial<T["data"]>): Promise<T["data"]> {
        /* Stub */
        return {} as any;
    }

    /**
     * Save all queued metrics to the database.
     */
    public async save(): Promise<void> {
        /* Stub */
    }
}