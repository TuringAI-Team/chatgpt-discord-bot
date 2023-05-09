import { AppDatabaseMetricsManager } from "./managers/metrics.js";
import { DatabaseManager } from "./manager.js";
import { App } from "../app.js";

export class AppDatabaseManager extends DatabaseManager<App> {
    /* Various sub-managers */
    public readonly metrics: AppDatabaseMetricsManager;

    constructor(bot: App) {
        super(bot);

        this.metrics = new AppDatabaseMetricsManager(this);
    }
}