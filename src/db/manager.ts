import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { Database } from "./types/db.js";
import { type Bot } from "../bot/bot.js";
import { type App } from "../app.js";
import { Config } from "../config.js";

export type DatabaseCollectionType = "users" | "conversations" | "guilds" | "interactions" | "images" | "keys" | "descriptions"

export type DatabaseManagerBot = Bot | App

export class DatabaseManager<T extends DatabaseManagerBot = Bot> {
    public readonly bot: T;

    /* Supabase client */
    public client: SupabaseClient<Database>;
    
    constructor(bot: T) {
        this.bot = bot;
        this.client = null!;
    }

    /**
     * Initialize the database manager & client.
     */
    public async setup(): Promise<void> {
        /* Supabase credentials */
        const { url, key } = this.config.db.supabase;

        /* Create the Supabase client. */
        this.client = createClient<Database>(url, key.service);
    }

    public collectionName(type: DatabaseCollectionType): string {
        return this.config.db.supabase.collections[type] ?? type;
    }

    private get config(): Config {
        return (this.bot as any).data
            ? (this.bot as any).data.app.config
            : (this.bot as any).config;
    }
}