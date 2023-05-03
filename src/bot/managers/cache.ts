import NodeCache from "node-cache";

import { DatabaseCollectionType } from "../../db/managers/user.js";
import { App } from "../../app.js";

/* How long to cache database entries for */
const DATABASE_CACHE_TTL: number = 30 * 60 * 1000

export type CacheType = DatabaseCollectionType | "cooldown"
export type CacheValue = any[] | { [key: string]: any }

const CacheDuration: Partial<Record<CacheType, number>> = {
    conversations: 60 * 60 * 1000,
    interactions: 5 * 60 * 1000,
    guilds: 60 * 60 * 1000,
    users: 60 * 60 * 1000
}

export class CacheManager {
    private app: App;
    public readonly cache: NodeCache;

    constructor(app: App) {
        this.app = app;
        
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
    ): Promise<void> {
        /* Update the cache for this cluster directly. */
        this.cache.set(
            this.keyName(collection, key), value,
            CacheDuration[collection] ?? DATABASE_CACHE_TTL
        );
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
        key: string
    ): Promise<void> {
        /* Delete the cache for this cluster directly. */
        this.cache.del(this.keyName(collection, key));
    }

    private keyName(collection: CacheType, key: string): string {
        return `${collection}-${key}`;
    }
}