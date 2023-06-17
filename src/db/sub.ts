import { type ClusterDatabaseManager } from "./cluster.js";
import { type AppDatabaseManager } from "./app.js";
import { DatabaseManager, DatabaseManagerBot } from "./manager.js";

export class SubDatabaseManager<T extends DatabaseManager<DatabaseManagerBot>> {
    protected readonly db: T;

    constructor(db: T) {
        this.db = db;
    }
}

export class SubClusterDatabaseManager extends SubDatabaseManager<ClusterDatabaseManager> {}
export class SubAppDatabaseManager extends SubDatabaseManager<AppDatabaseManager> {}
