import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { Database } from "./types/db.js";
import { type Bot } from "../bot/bot.js";
import { type App } from "../app.js";

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
        const { url, key } = (this.bot as any).data ? (this.bot as any).data.app.config.db.supabase : (this.bot as any).config!.db.supabase;

        /* Create the Supabase client. */
        this.client = createClient<Database>(url, key.service);
    }
}