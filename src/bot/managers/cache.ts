import { RedisClientType, createClient } from "redis";

import { DatabaseCollectionType } from "../../db/manager.js";
import { App } from "../../app.js";

/* How long to cache database entries for, by default */
const DATABASE_CACHE_TTL: number = 30 * 60

export type CacheType = DatabaseCollectionType | "cooldown"
export type CacheValue = any[] | { [key: string]: any }

const CacheDuration: Partial<Record<CacheType, number>> = {
    conversations: 60 * 60,
    interactions: 5 * 60,
    guilds: 60 * 60,
    users: 60 * 60
}

export class CacheManager {
    public client: RedisClientType;
    private readonly app: App;

    constructor(app: App) {
        this.client = null!;
        this.app = app;
    }

    public async setup(): Promise<void> {
        this.client = createClient({
            socket: {
                host: this.app.config.db.redis.url,
                port: this.app.config.db.redis.port
            },
            password: this.app.config.db.redis.password
        });

        await this.client.connect();
    }

    public async set(
        collection: CacheType,
        key: string,
        value: CacheValue
    ): Promise<void> {
        this.client.set(this.keyName(collection, key), JSON.stringify(value));
        this.client.expire(this.keyName(collection, key), CacheDuration[collection] ?? DATABASE_CACHE_TTL);
    }

    public async get<T>(
        collection: CacheType,
        key: string
    ): Promise<T | null> {
        const raw: string | null = await this.client.get(this.keyName(collection, key));
        if (raw === null) return null;

        return JSON.parse(raw);
    }

    public async delete(
        collection: CacheType,
        key: string
    ): Promise<void> {
        this.client.del(this.keyName(collection, key));
    }

    private keyName(collection: CacheType, key: string): string {
        return `${collection}:${key}`;
    }
}