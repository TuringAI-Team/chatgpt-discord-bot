import { DatabaseCollectionType, DatabaseLikeObject, DatabaseManager } from "./manager.js";
import { ClusterDatabaseMetricsManager } from "./managers/metrics.js";
import { ClusterDatabaseQueueManager } from "./managers/queue.js";
import { ClusterCampaignManager } from "./managers/campaign.js";
import { ClusterSettingsManager } from "./managers/settings.js";
import { ClusterPlanManager } from "./managers/plan.js";
import { StorageManager } from "./managers/storage.js";
import { BotClusterManager } from "../bot/manager.js";
import { UserRoleManager } from "./managers/role.js";
import { DatabaseSchema } from "./schemas/schema.js";
import { CacheManager } from "./managers/cache.js";
import { UserManager } from "./managers/user.js";
import { type Bot } from "../bot/bot.js";
import { App } from "../app.js";


type Runner<T, U = any> = (app: App, context: U) => Promise<T>
type SchemaRunner<ReturnValue, Schema extends DatabaseSchema, Entry extends DatabaseLikeObject, Context> = (app: App, schema: Schema, entry: Entry, context: Context) => Promise<ReturnValue>

export class ClusterDatabaseManager extends DatabaseManager<Bot> {
    /* Various sub-managers */
    public readonly metrics: ClusterDatabaseMetricsManager;
    public readonly queue: ClusterDatabaseQueueManager;
    public readonly campaign: ClusterCampaignManager;
    public readonly settings: ClusterSettingsManager;
    public readonly plan: ClusterPlanManager;
    public readonly storage: StorageManager;
    public readonly role: UserRoleManager;
    public readonly cache: CacheManager;
    public readonly users: UserManager;

    constructor(bot: any) {
        super(bot);

        this.metrics = new ClusterDatabaseMetricsManager(this);
        this.queue = new ClusterDatabaseQueueManager(this);
        this.campaign = new ClusterCampaignManager(this);
        this.settings = new ClusterSettingsManager(this);
        this.plan = new ClusterPlanManager(this);
        this.storage = new StorageManager(this);
        this.role = new UserRoleManager(this);
        this.cache = new CacheManager(this);
        this.users = new UserManager(this);
    }

    public async setup(): Promise<void> {
        await super.setup();

        /* Set up the various sub-managers. */
        await this.storage.setup();
    }

    public async schema<ReturnValue = any, Schema extends DatabaseSchema = DatabaseSchema, Entry extends DatabaseLikeObject = DatabaseLikeObject, Context = any>(type: DatabaseCollectionType, entry: Entry, runner: SchemaRunner<ReturnValue, Schema, Entry, Context>, context?: Context): Promise<ReturnValue>;
    public async schema<Schema extends DatabaseSchema = DatabaseSchema, Entry extends DatabaseLikeObject = DatabaseLikeObject, Context = any>(type: DatabaseCollectionType, entry: Entry, runner: SchemaRunner<void, Schema, Entry, Context>, context?: Context): Promise<void>;

    public async schema<ReturnValue, Schema extends DatabaseSchema = DatabaseSchema, Entry extends DatabaseLikeObject = DatabaseLikeObject, Context = any>(
        type: DatabaseCollectionType, entry: Entry, runner: SchemaRunner<ReturnValue, Schema, Entry, Context>, context?: Context
    ): Promise<ReturnValue | void> {
        return this.eval(async (app, { type, runner, entry, context }) => {
            /* Get the corresponding schema. */
            const schema = app.db.schema(type);
            return await eval(`(${runner})(app, schema, entry, context)`);
        }, {
            type, entry, runner: runner.toString(), context: context
        });
    }

    public async fetchFromCacheOrDatabase<T extends DatabaseLikeObject | string, U extends DatabaseLikeObject>(
        type: DatabaseCollectionType, object: T | string
    ): Promise<U | null> {
        return this.eval((app, { type, object }) => {
            return app.db.fetchFromCacheOrDatabase<T, U>(type, object);
        }, {
            type, object
        });
    }

    public async createFromCacheOrDatabase<T extends string | DatabaseLikeObject, U extends DatabaseLikeObject, V extends DatabaseLikeObject>(
        type: DatabaseCollectionType, object: T, source?: V
    ): Promise<U> {
        return this.eval((app, { type, object }) => {
            return app.db.createFromCacheOrDatabase<T, U, V>(type, object);
        }, {
            type, object, source
        });
    }

    public async eval<U = any>(runner: Runner<void, U>, context?: U): Promise<void>;
    public async eval<T, U = any>(runner: Runner<T, U>, context?: U): Promise<T>;

    public async eval<T, U = any>(runner: Runner<T, U>, context?: U): Promise<T | void> {
        const value: T = await this.bot.client.cluster.evalOnManager((async (manager: BotClusterManager, context: { function: string, data: U }) => {
            const value = await eval(`(${context.function})(manager.bot.app, context.data)`);
            return value;
        }) as any, {
            context: {
                function: runner.toString(),
                data: context
            }, timeout: 45 * 1000
        });

        if (value !== void 0) return value;
        else return;
    }
}