import NodeCache from "node-cache";

import { BotDiscordClient } from "../../bot/bot.js";
import { DatabaseCollectionType } from "./user.js";
import { DatabaseManager } from "../manager.js";

/* How long to cache database entries for */
const DATABASE_CACHE_TTL: number = 30 * 60 * 1000

export type CacheType = DatabaseCollectionType | "cooldown"
export type CacheValue = any[] | { [key: string]: any }

const CacheDuration: Partial<Record<CacheType, number>> = {
    conversations: 5 * 60 * 1000,
    interactions: 5 * 60 * 1000,
    guilds: 60 * 60 * 1000,
    users: 60 * 60 * 1000
}

export class CacheManager {
    private db: DatabaseManager;
    public readonly cache: NodeCache;

    constructor(db: DatabaseManager) {
        this.db = db;
        
        /* Initialize the cache. */
        this.cache = new NodeCache({
            deleteOnExpire: true,
            checkperiod: 5 * 60
        });
    }

    public async set(
        collection: CacheType,
        key: string,
        value: CacheValue,
        direct: boolean = false
    ): Promise<void> {
        /* Update the cache for this cluster directly. */
        this.cache.set(
            this.keyName(collection, key), value,
            CacheDuration[collection] ?? DATABASE_CACHE_TTL
        );

        /* Set the cache for every cluster. */
        if (!direct) this.db.bot.client.cluster.broadcastEval((async (client: BotDiscordClient, context: { collection: DatabaseCollectionType; key: string; value: any; from: number }) => {
            if (client.bot.data.id !== context.from) await client.bot.db.cache.set(context.collection, context.key, context.value, true);
        }) as any, {
            context: { key, value, collection, from: this.db.bot.data.id }
        });
    }

    public async get<T>(
        collection: CacheType,
        key: string
    ): Promise<T | null> {
        const raw: T | null = await this.cache.get(this.keyName(collection, key)) ?? null;
        if (raw === null) return null;

        return raw as T;
    }

    public async delete(
        collection: CacheType,
        key: string,
        direct: boolean = false
    ): Promise<void> {
        /* Delete the cache for this cluster directly. */
        this.cache.del(this.keyName(collection, key));

        /* Delete the cache for every cluster. */
        if (!direct) this.db.bot.client.cluster.broadcastEval((async (client: BotDiscordClient, context: { collection: DatabaseCollectionType; key: string; from: number }) => {
            if (client.bot.data.id !== context.from) await client.bot.db.cache.delete(context.collection, context.key, true);
        }) as any, {
            context: { key, collection, from: this.db.bot.data.id }
        });
    }

    private keyName(collection: CacheType, key: string): string {
        return `${collection}-${key}`;
    }
}