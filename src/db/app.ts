import { Awaitable, Collection } from "discord.js";

import { DatabaseCollectionType, DatabaseLikeObject, DatabaseManager } from "./manager.js";
import { AppDatabaseMetricsManager } from "./managers/metrics.js";
import { AppDatabaseQueueManager } from "./managers/queue.js";
import { GPTDatabaseError } from "../error/gpt/db.js";
import { DatabaseSchemaMap, DatabaseSchemas } from "./schemas/index.js";
import { DatabaseSchema } from "./schemas/schema.js";
import { App } from "../app.js";

export class AppDatabaseManager extends DatabaseManager<App> {
    /* Various sub-managers */
    public readonly metrics: AppDatabaseMetricsManager;
    public readonly queue: AppDatabaseQueueManager;

    /* The schemas for all database types */
    private readonly schemas: Collection<DatabaseCollectionType, DatabaseSchema>;

    constructor(bot: App) {
        super(bot);

        this.metrics = new AppDatabaseMetricsManager(this);
        this.queue = new AppDatabaseQueueManager(this);

        this.schemas = new Collection();

        /* Initialize the schemas. */
        for (const schema of DatabaseSchemas) {
            /* Create an instance of the schema. */
            const instance = new schema(this);
            this.schemas.set(instance.settings.collection, instance);
        }
    }

    public schema<CollectionType extends DatabaseCollectionType>(type: CollectionType): DatabaseSchemaMap[CollectionType] {
        const schema = this.schemas.get(type) ?? null;
        if (schema === null) throw new Error(`Couldn't find schema "${type}"`);

        return schema as DatabaseSchemaMap[CollectionType];
    }

    public async fetchFromCacheOrDatabase<T extends DatabaseLikeObject | string, U extends Partial<DatabaseLikeObject>>(
        type: DatabaseCollectionType, object: T | string
    ): Promise<U | null> {
        const id: string = typeof object === "string" ? object : object.id;
        const schema = this.schema(type);

        const existing: U | null = await this.bot.cache.get(type, id);
        if (existing) return existing;

        const { data, error } = await this.client
            .from(this.collectionName(type)).select("*")
            .eq("id", id);

        if (error !== null) throw new GPTDatabaseError({ collection: type, raw: error });
        if (data === null || data.length === 0) return null;

        /* Raw database entry */
        const raw: U = data[0];

        /* Process the raw database entry into a formatted format. */
        let final: U = await schema.process(raw as any) as U;

        /* If the process() callback didn't return anything, just use the raw data. */
        if (final === null) final = raw;

        await this.setCache(type, id, final);
        return final;
    }

    public async createFromCacheOrDatabase<T extends string | DatabaseLikeObject, U extends DatabaseLikeObject, V extends DatabaseLikeObject>(
        type: DatabaseCollectionType, object: T, source?: V
    ): Promise<U> {
        const data: U | null = await this.fetchFromCacheOrDatabase(type, object);
        if (data !== null) return data;

        const id: string = typeof object === "string" ? object : object.id;
        const schema = this.schema(type);

        /* Otherwise, try to create a new entry using the template creator. */
        const template: U | null = await schema.template(id, source as any) as U | null;
        if (template === null) throw new Error(`Schema "${schema.settings.collection}" doesn't have a template`);

        /* Process the template database entry into a formatted format. */
        let final: U = await schema.process(template as any) as U;

        /* If the process() callback didn't return anything, just use the template data. */
        if (final === null) final = template;
        
        await this.queue.update(type, object, final);
        return final;
    }

    public async setCache<T extends DatabaseLikeObject = DatabaseLikeObject>(type: DatabaseCollectionType, obj: T | string, updates?: Partial<T>): Promise<T> {
       const id: string = typeof obj === "string" ? obj : obj.id;
        let updated: T;
        
        if (typeof obj === "string") {
            const existing: T | null = typeof obj === "string" ? await this.bot.cache.get(type, id) ?? null : null;
            updated = { ...existing ?? {}, ...updates as T };
        } else {
            const existing: T = await this.bot.cache.get(type, id) ?? obj;
            updated = { ...existing, ...updates as T };
        }

        await this.bot.cache.set(type, id, updated);
        return updated;
    }
}