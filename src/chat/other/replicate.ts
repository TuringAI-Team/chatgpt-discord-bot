import Replicate from "replicate";

import { Bot } from "../../bot/bot.js";

export class ReplicateManager {
    private readonly bot: Bot;

    /* The actual Replicate API */
    public api: Replicate;

    constructor(bot: Bot) {
        this.bot = bot;
        this.api = null!;
    }

    /**
     * Set up the Replicate API client & manager.
     */
    public async setup(): Promise<void> {
        /* Create the API client. */
        this.api = new Replicate({
            auth: this.bot.app.config.replicate.key
        });
    }
}