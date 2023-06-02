import { Awaitable } from "discord.js";
import chalk from "chalk";

import { Bot, BotDiscordClient, BotStatistics } from "./bot.js";
import { DB_CACHE_INTERVAL } from "../db/managers/user.js";
import { Git, GitCommit } from "../util/git.js";
import { getInfo } from "discord-hybrid-sharding";

enum BotTaskType {
    RunOnStart
}

export interface BotTask {
    /* Name of the task */
    name: string;

    /* Interval to execute this task at */
    interval: number;

    /* Type of the task */
    type?: BotTaskType;

    /* Only execute this bot task if this condition is met */
    condition?: (bot: Bot) => boolean;

    /* Callback to execute this task */
    callback: (bot: Bot) => Awaitable<void>;
}

const BOT_TASKS: BotTask[] = [
    {
        name: "Post top.gg stats",
        interval: 30 * 60 * 1000,

        condition: bot => bot.data.id === 0 && !bot.dev,
        callback: async bot => await bot.vote.postStatistics()
    },

    {
        name: "Save database changes",
        interval: DB_CACHE_INTERVAL,

        callback: async bot => await bot.db.users.workOnQueue()
    },

    {
        name: "Save metric entries",
        interval: 60 * 60 * 1000,

        condition: bot => bot.data.id === 0 && !bot.dev,
        callback: async bot => await bot.db.metrics.save()
    },

    {
        name: "Get bot statistics",
        type: BotTaskType.RunOnStart,

        condition: bot => bot.data.id === 0,
        interval: 5 * 60 * 1000,

        callback: async bot => {
            /* Total guild count */
            const guildCount: number = ((await bot.client.cluster.fetchClientValues("guilds.cache.size")) as number[])
                .reduce((value, count) => value + count, 0);

            /* Total Discord user count */
            const discordUsers: number = (await bot.client.cluster.broadcastEval(client => client.guilds.cache.reduce((value, guild) => value + (!isNaN(guild.memberCount) ? guild.memberCount : 0), 0)) as number[])
                .reduce((value, count) => value + count, 0);

            /* Total database user count */
            const databaseUsers: number = (await bot.db.client.from(bot.db.collectionName("users")).select("*", { count: "estimated" })).count ?? 0;

            /* Total conversation count */
            const conversations: number = ((await bot.client.cluster.fetchClientValues("bot.conversation.conversations.size")) as number[])
                .reduce((value, count) => value + count, 0);

            /* Latest Git commit in the repository */
            const commit: GitCommit = await Git.latestCommit();

            const data: BotStatistics = {
                conversations: conversations,
                discordPing: bot.client.ws.ping,
                memoryUsage: process.memoryUsage().heapUsed,
                guildCount: guildCount,
                discordUsers: discordUsers,
                databaseUsers: databaseUsers,
                commit: commit
            };
            
            await bot.client.cluster.broadcastEval(((client: BotDiscordClient, context: BotStatistics) => {
                client.bot.statistics = context;
            }) as any, {
                context: data, timeout: 10 * 1000
            });

            await bot.db.metrics.changeGuildsMetric({
                total: guildCount
            });

            bot.statistics = data;
        }
    }
]

export class TaskManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Set up the various tasks.
     */
    public setup(): void {
        BOT_TASKS.forEach(task => {
            if (task.type === BotTaskType.RunOnStart) {
                if (!this.bot.started) this.bot.on("started", () => this.executeTask(task));
                else this.executeTask(task);
            }
            
            this.prepareTask(task);
        });
    }

    private prepareTask(task: BotTask): NodeJS.Timer {
        const timer: NodeJS.Timer = setInterval(() => this.executeTask(task), task.interval);
        return timer;
    }

    private async executeTask(task: BotTask): Promise<void> {
        /* If the bot hasn't fully started yet, ignore this. */
        if (!this.bot.started) return;

        /* If the condition to execute this task isn't met, ignore this. */
        if (task.condition && !task.condition(this.bot)) return;

        /* Try to execute the task. */
        try {
            await task.callback(this.bot);
        } catch (error) {
            this.bot.logger.error(`Failed to execute task ${chalk.bold(task.name)} ->`, error);
        }
    }
}