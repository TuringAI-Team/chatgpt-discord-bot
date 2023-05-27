import chalk from "chalk";

import { CacheType, CacheValue } from "../../bot/managers/cache.js";
import { BotClusterManager } from "../../bot/manager.js";
import { DatabaseCollectionType } from "../manager.js";
import { ClientDatabaseManager } from "../cluster.js";

type CacheEvalAction = "get" | "delete" | "set"

export class CacheManager {
    private db: ClientDatabaseManager;

    constructor(db: ClientDatabaseManager) {
        this.db = db;
    }

    public async set(
        collection: CacheType,
        key: string,
        value: CacheValue
    ): Promise<void> {
        await this.eval("set", collection, key, value);
    }

    public async get<T>(
        collection: CacheType,
        key: string
    ): Promise<T | null> {
        const raw: T | null = await this.eval("get", collection, key) ?? null;
        if (raw === null) return null;

        return raw as T;
    }

    public async delete(
        collection: CacheType,
        key: string
    ): Promise<void> {
        await this.eval("delete", collection, key);
    }

    public async eval<T>(
        action: "get", collection: CacheType, key: string
    ): Promise<T>;

    public async eval(
        action: "delete", collection: CacheType, key: string
    ): Promise<void>;

    public async eval(
        action: "set", collection: CacheType, key: string, value: CacheValue
    ): Promise<void>;

    public async eval<T = any>(
        action: CacheEvalAction,
        collection: CacheType,
        key: string,
        value?: CacheValue
    ): Promise<T | void> {
        if (this.db.bot.dev) this.db.bot.logger.debug(
            `${chalk.bold(action)} in cache collection ${chalk.bold(collection)} for key ${chalk.bold(key)}`
        );

        /* Try to perform the specified action on the cache, on the bot manager. */
        try {
            const data: any | void = await this.db.bot.client.cluster.evalOnManager((async (manager: BotClusterManager, context: {
                action: CacheEvalAction; collection: DatabaseCollectionType; key: string; value?: CacheValue;
            }) => {
                if (context.action === "set") {
                    await manager.bot.app.cache.set(context.collection, context.key, context.value!);
                } else if (context.action === "get") {
                    return await manager.bot.app.cache.get(context.collection, context.key);
                } else if (context.action === "delete") {
                    await manager.bot.app.cache.delete(context.collection, context.key);
                }
            }) as any, {
                timeout: 15 * 1000,
                context: {
                    action, collection, key, value
                }
            });

            /* If the specified action was `get`, return the received value. */
            if (typeof data === "object") return data as T;
            else return;

        } catch (error) {
            this.db.bot.logger.error(
                `Failed to ${chalk.bold(action)} in cache collection ${chalk.bold(collection)} for key ${chalk.bold(key)} ->`, error
            );

            throw error;
        }
    }
}