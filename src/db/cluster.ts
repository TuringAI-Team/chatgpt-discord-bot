import { ClusterDatabaseMetricsManager } from "./managers/metrics.js";
import { ImageDescriptionManager } from "./managers/description.js";
import { UserSettingsManager } from "./managers/settings.js";
import { StorageManager } from "./managers/storage.js";
import { CacheManager } from "./managers/cache.js";
import { UserManager } from "./managers/user.js";
import { DatabaseManager } from "./manager.js";
import { type Bot } from "../bot/bot.js";

export class ClientDatabaseManager extends DatabaseManager<Bot> {
    /* Various sub-managers */
    public readonly metrics: ClusterDatabaseMetricsManager;
    public readonly description: ImageDescriptionManager;
    public readonly settings: UserSettingsManager;
    public readonly storage: StorageManager;
    public readonly cache: CacheManager;
    public readonly users: UserManager;

    constructor(bot: any) {
        super(bot);

        this.metrics = new ClusterDatabaseMetricsManager(this);
        this.description = new ImageDescriptionManager(this);
        this.settings = new UserSettingsManager(this);
        this.storage = new StorageManager(this);
        this.cache = new CacheManager(this);
        this.users = new UserManager(this);
    }

    public async setup(): Promise<void> {
        await super.setup();

        /* Set up the various sub-managers. */
        await this.storage.setup();
    }
}