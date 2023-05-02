import Replicate from "replicate";

import { Bot } from "../../bot/bot.js";

const REPLICATE_DURATION_REGEXP = /([0-5]?\d):([0-5]\d)/

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

    /**
     * Extract the remaining duration from the Replicate generation output.
     * @param output Raw Replicate output
     * 
     * @returns The remaining duration, or `null`
     */
    public remainingDuration(output: string): number | null {
        const line: string = output.split("\n").reverse()[0];
        const matches = line.match(REPLICATE_DURATION_REGEXP);

        if (matches) {
            const minutes = parseInt(matches[1], 10);
            const seconds = parseInt(matches[2], 10);

            return minutes * 60 + seconds;

        /* Otherwise, ignore it. */
        } else return null;
    }
}