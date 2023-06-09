import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { type Bot } from "../bot/bot.js";
import { Config } from "../config.js";
import { type App } from "../app.js";

export type DatabaseCollectionType = "users" | "conversations" | "guilds" | "interactions" | "images" | "descriptions" | "errors"
export type DatabaseManagerBot = Bot | App

export class DatabaseManager<T extends DatabaseManagerBot = Bot> {
    public readonly bot: T;

    /* Supabase client */
    public client: SupabaseClient;
    
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
        this.client = createClient(url, key.service, {
            auth: {
                persistSession: false
            }            
        });
    }

    public collectionName(type: DatabaseCollectionType): string {
        if (!this.config.db.supabase.collections) return type;
        return this.config.db.supabase.collections[type] ?? type;
    }

    private get config(): Config {
        return (this.bot as any).data
            ? (this.bot as any).data.app.config
            : (this.bot as any).config;
    }
}