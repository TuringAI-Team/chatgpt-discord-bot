import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { UserSettingsManager } from "./managers/settings.js";
import { StorageManager } from "./managers/storage.js";
import { CacheManager } from "./managers/cache.js";
import { UserManager } from "./managers/user.js";
import { Database } from "./types/db.js";
import { Bot } from "../bot/bot.js";

export class DatabaseManager {
    public readonly bot: Bot;

    /* Supabase client */
    public client: SupabaseClient<Database>;

    /* Various sub-managers */
    public settings: UserSettingsManager;
    public storage: StorageManager;
    public cache: CacheManager;
    public users: UserManager;
    
    constructor(bot: Bot) {
        this.bot = bot;
        this.client = null!;

        this.settings = new UserSettingsManager(this);
        this.storage = new StorageManager(this);
        this.cache = new CacheManager(this);
        this.users = new UserManager(this);
    }

    /**
     * Initialize the database manager & client.
     */
    public async setup(): Promise<void> {
        /* Supabase credentials */
        const { url, key } = this.bot.data.app.config.db.supabase;

        /* Create the Supabase client. */
        this.client = createClient<Database>(url, key.service);

        /* Set up the various sub-managers. */
        await this.storage.setup();
    }
}