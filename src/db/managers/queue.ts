import { Collection } from "discord.js";
import chalk from "chalk";

import { DatabaseCollectionType, DatabaseCollectionTypes, DatabaseLikeObject, DatabaseManager, DatabaseManagerBot } from "../manager.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { AppDatabaseManager } from "../app.js";
import { SubDatabaseManager } from "../sub.js";
import { Utils } from "../../util/utils.js";

/* How often to save cached entries to the database */
export const DatabaseCacheInterval: number = 3 * 60 * 1000

export class DatabaseQueueManager<T extends DatabaseManager<DatabaseManagerBot>> extends SubDatabaseManager<T> {}

export class ClusterDatabaseQueueManager extends DatabaseQueueManager<ClusterDatabaseManager> {
    public async update<T extends DatabaseLikeObject = DatabaseLikeObject>(type: DatabaseCollectionType, obj: T | string, updates: Partial<T> = {}): Promise<T> {
        return await this.db.eval<T>(async (app, { type, obj, updates }) => {
            return await app.db.queue.update(type, obj, updates);
        }, {
            type, obj, updates
        });
    }

    public async work(): Promise<void> {
        await this.db.eval(async app => {
            app.db.queue.work();
        });
    }
}

export class AppDatabaseQueueManager extends DatabaseQueueManager<AppDatabaseManager> {
    /* All queued updates */
    public readonly updates: Record<DatabaseCollectionType, Collection<string, DatabaseLikeObject>>;

    constructor(db: AppDatabaseManager) {
        super(db);
        this.updates = {} as any;

        for (const type of DatabaseCollectionTypes) {
            this.updates[type] = new Collection();
        }
    }

    public async update<T extends DatabaseLikeObject = DatabaseLikeObject>(type: DatabaseCollectionType, obj: T | string, updates: Partial<T> = {}): Promise<T> {
        const id: string = typeof obj === "string" ? obj : obj.id;

        const queued: T | null = this.updates[type].get(id) as T ?? null;
        let updated: T;

        if (typeof obj === "string") {
            updated = { ...queued, ...updates as T };
        } else {
            updated = { ...obj, ...queued, ...updates as T };
        }

        this.updates[type].set(id, updated);
        await this.db.setCache(type, obj, updated);

        return updated;
    }

    public async work(): Promise<void> {
        for (const type of Object.keys(this.updates) as DatabaseCollectionType[]) {
            const collection: Collection<string, DatabaseLikeObject> = this.updates[type];
            const entries: [ string, DatabaseLikeObject ][] = Array.from(collection.entries());

            /* Entries to work on */
            const changes: DatabaseLikeObject[] = entries.map(([ _, updated ]) => updated);
            if (changes.length === 0) continue;

            /* Apply the changes to the database. */
            for (const [ i, e ] of changes.entries()) {
                const id: string = entries[i][0];

                const modified = {
                    id, ...e as any
                };

                const { error } = await this.db.client
                    .from(this.db.collectionName(type))
                    .upsert(modified, { onConflict: "id" });

                /* If an error occurred, log it to the console. */
                if (error !== null) {
                    this.db.bot.logger.error(`Something went wrong while trying to save ${chalk.bold(id)} to collection ${chalk.bold(type)} ->`, error);

                /* If the request worked, remove it from the queued changes collection.

                   We only actually remove the changes from the database if they don't fail,
                   otherwise the database and cache won't match up anymore, which will eventually lead to data loss. */
                } else if (error === null) {
                    if (this.db.bot.dev) this.db.bot.logger.debug(
                        chalk.bold("Database update"),
                        `-> collection ${chalk.bold(type)}`,
                        `-> ID ${chalk.bold(id)}`,
                        `-> changes:`, Utils.truncate(JSON.stringify(modified, undefined, 4), 200, chalk.bold("..."))
                    );

                    this.updates[type].delete(id);
                }
            }
        }
    }
}