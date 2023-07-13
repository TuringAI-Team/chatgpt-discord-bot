import { Awaitable } from "discord.js";

import { DatabaseCollectionType, DatabaseLikeObject } from "../manager.js";
import { type AppDatabaseManager } from "../app.js";

export interface DatabaseSchemaSettings {
    /** Which collection this schema belongs to */
    collection: DatabaseCollectionType;
}

export abstract class DatabaseSchema<Data extends DatabaseLikeObject = DatabaseLikeObject, Source extends DatabaseLikeObject = DatabaseLikeObject> {
    protected readonly db: AppDatabaseManager;

    /* Settings about the schema */
    public readonly settings: Required<DatabaseSchemaSettings>;

    constructor(db: AppDatabaseManager, settings: DatabaseSchemaSettings) {
        this.db = db;
        this.settings = settings;
    }

    public async update(object: string | Data, updates: Partial<Data>): Promise<Data> {
        return this.db.queue.update(this.settings.collection, object, updates);
    }

    public async get(object: string | Data): Promise<Data | null> {
        return this.db.fetchFromCacheOrDatabase(this.settings.collection, object);
    }

    /**
     * Do some transformation on the given database object.
     */
    public process(raw: Data): Awaitable<Data | null> {
        /* Stub */
        return null;
    }

    /**
     * Generate a template for this schema.
     */
    public template(id: Source["id"]): Awaitable<Data | null> {
        /* Stub */
        return null;
    }
}