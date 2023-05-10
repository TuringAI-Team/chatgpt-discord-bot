import { User } from "discord.js";
import chalk from "chalk";

import { DatabaseUser } from "../db/managers/user.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";
import { getInfo } from "discord-hybrid-sharding";

type VoteAPIPath = string

export class VoteManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Check if a user has voted for the bot.
     * @param user User to check for
     * 
     * @returns Whether the user has voted for the bot
     */
    public async voted(user: User, db: DatabaseUser): Promise<boolean> {
        if (this.bot.db.users.voted(db) !== null) return true;

        /* Check whether the user has voted, using the API. */
        const { voted }: { voted: number } = await this.request(`${this.botPath("check")}?userId=${user.id}`, "GET");
        if (!voted) return false;

        /* Update the user's vote status in the database. */
        await this.bot.db.users.updateUser(db, {
            voted: new Date().toISOString()
        });

        await this.bot.db.metrics.changeVoteMetric({ count: "+1" });
        await this.bot.db.users.incrementInteractions(db, "votes");
        
        if (this.bot.dev) this.bot.logger.debug(`User ${chalk.bold(user.tag)} has voted for the bot!`);
        return true;
    }

    public async postStatistics(): Promise<void> {
        const guilds: number = ((await this.bot.client.cluster.fetchClientValues("guilds.cache.size")) as number[])
            .reduce((value, count) => value + count, 0);

        const shardCount: number = getInfo().TOTAL_SHARDS;

        const data = {
            server_count: guilds,
            shard_count: shardCount
        };

        await this.request(this.botPath("stats"), "POST", data);
    }

    private botPath(path: "check" | "stats"): VoteAPIPath {
        return `bots/${this.bot.app.config.discord.id}/${path}`;
    }

    private async request<T>(path: VoteAPIPath, method: "GET" | "POST" | "DELETE" = "GET", data?: { [key: string]: any }): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.status.toString().startsWith("2")) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.json() as T;
        return body;
    }

    private url(path: VoteAPIPath): `https://top.gg/api/${VoteAPIPath}` {
        return `https://top.gg/api/${path}`;
    }

    private async error(response: Response, path: VoteAPIPath): Promise<void> {
        const body: any | null = await response.json().catch(() => null);
    
        throw new GPTAPIError({
            code: response.status,
            endpoint: `/${path}`,
            id: null,
            message: body !== null && body.message ? body.message : null
        });
    }

    private headers(): HeadersInit {
        return {
            Authorization: this.bot.app.config.topgg.key,
            "Content-Type": "application/json"
        };
    }
}