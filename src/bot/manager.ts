import { Collection, ColorResolvable, EmbedBuilder, REST, Routes } from "discord.js";
import { Cluster, ClusterManager, ReClusterManager } from "discord-hybrid-sharding";
import { setTimeout as delay } from "node:timers/promises";
import { EventEmitter } from "node:events";
import chalk from "chalk";

import { App, StrippedApp } from "../app.js";
import { Bot, BotStatus } from "./bot.js";

export interface BotDataSessionLimit {
    maxConcurrency: number;
    remaining: number;
    total: number;
}

export interface BotData {
    /* Stripped-down app information */
    app: StrippedApp;

    /* Discord /gateway/bot information */
    session: BotDataSessionLimit;
    
    /* Cluster identifier */
    id: number;
}

enum DiscordWebhookAnnounceType {
    /** The bot was started successfully */
    StartBot,

    /** The bot crashed */
    CrashBot,

    /** The bot was reloaded */
    ReloadBot,

    /** A cluster was started successfully */
    StartCluster,

    /** A cluster was stopped */
    StopCluster
}

const DiscordWebhookAnnounceTypeMap: { [key: number]: string } = {
    [DiscordWebhookAnnounceType.StartBot]: "Bot is online 🟢",
    [DiscordWebhookAnnounceType.CrashBot]: "Bot has crashed 🔴",
    [DiscordWebhookAnnounceType.ReloadBot]: "Bot has been reloaded ⏳",
    [DiscordWebhookAnnounceType.StartCluster]: "Cluster #% has started 🟢",
    [DiscordWebhookAnnounceType.StopCluster]: "Cluster #% has stopped 🔴"
}

const DiscordWebhookAnnounceColorMap: { [key: number]: ColorResolvable } = {
    [DiscordWebhookAnnounceType.StartBot]: "Green",
    [DiscordWebhookAnnounceType.CrashBot]: "Red",
    [DiscordWebhookAnnounceType.ReloadBot]: "Yellow",
    [DiscordWebhookAnnounceType.StartCluster]: "Green",
    [DiscordWebhookAnnounceType.StopCluster]: "Red"
}

export type BotClusterManager = ClusterManager & {
    bot: BotManager;
}

export declare interface BotManager {
    on(event: "create", listener: (bot: Bot) => void): this;
}

export class BotManager extends EventEmitter {
    public readonly app: App;

    /* Discord cluster sharding manager */
    private manager: BotClusterManager | null;

    /* Collection of active clusters */
    public clusters: Collection<number, Cluster>;

    /* Discord REST client, to announce cluster updates */
    public rest: REST;

    /* Status of the bot */
    public status: BotStatus;

    /* Whether all clusters have started */
    public started: boolean;

    /* Discord /gateway/bot information */
    public session: BotDataSessionLimit | null;

    constructor(app: App) {
        super();
        this.app = app;

        this.started = false;
        this.session = null;
        this.rest = null!;

        /* Initialize the cluster sharding manager. */
        this.clusters = new Collection();
        this.manager = null;

        this.status = {
            type: "operational",
            since: Date.now()
        };
    }

    private formatStatusEmbed(type: DiscordWebhookAnnounceType, cluster?: Cluster): EmbedBuilder {
        return new EmbedBuilder()
            .setTitle(DiscordWebhookAnnounceTypeMap[type].replaceAll("%", (cluster !== undefined ? cluster.id + 1 : -1).toString()))
            .setColor(DiscordWebhookAnnounceColorMap[type])
            .setTimestamp();
    }

    /**
     * Announce a cluster start/crash/update to a Discord webhook.
     * 
     * @param type Type of announcement
     * @param cluster Cluster that was affected, optional
     */
    private async announce(type: DiscordWebhookAnnounceType, cluster?: Cluster): Promise<void> {
        /* Create the initial embed. */
        const embed = this.formatStatusEmbed(type, cluster);

        await this.rest.post(Routes.channelMessages(this.app.config.channels.status.channel), {
            body: {
                embeds: [ embed.toJSON() ]
            }
        }).catch(() => {});
    }

    /**
     * Internal event, called when a cluster child process dies
     * @param cluster Cluster that exited
     */
    private async onDeath(cluster: Cluster): Promise<void> {
        this.app.logger.error(`Cluster ${chalk.bold(`#${cluster.id + 1}`)} experienced an error, attempting to restart.`);
        this.announce(DiscordWebhookAnnounceType.StopCluster, cluster);

        /* Try to respawn the dead cluster, and then mark it as initialized again. */
        await this.onCreate(cluster).then(() => this.sendDone([ cluster ]));
    }

    /**
     * Internal event, called when a cluster gets initialized
     * @param cluster Cluster that was started
     */
    private async onCreate(cluster: Cluster): Promise<void> {
        /* Wait for the cluster to get launched, before we proceed. */
        await new Promise<void>(resolve => cluster.once("spawn", () => resolve()));

        /* Add the cluster to the collection. */
        this.clusters.set(cluster.id, cluster);

        /* Catch the exit of the cluster child process. */
        cluster.once("death", async (cluster) => await this.onDeath(cluster));

        /* Send all necessary data to the cluster worker. */
        await cluster.send({
            content: {
                app: this.app.strip(),
                id: cluster.id
            } as BotData
        });

        if (this.started) await this.sendDone([ cluster ]);
        await this.onReady(cluster);
    }

    /**
     * Internal event, called when a cluster's client is marked as ready
     * @param cluster Cluster that was initialized
     */
    private async onReady(cluster: Cluster): Promise<void> {
        /* Check whether this is the "initial" start of the cluster, when the cluster manager gets initialized, or if the cluster was restarted. */
        if (cluster.restarts.current > 0) await this.announce(DiscordWebhookAnnounceType.StartCluster, cluster);
    }

    /**
     * Emit to all or the specified clusters that the starting process is over.
     */
    private async sendDone(clusters?: Cluster[]): Promise<void> {
        return void await Promise.all((clusters ?? Array.from(this.clusters.values())).map(cluster => cluster.send({
            content: "done"
        })));
    }

    /**
     * Handler, for when the cluster manager crashes
     */
    private crashed(error: Error): void {
        this.app.logger.error(chalk.bold("The application crashed, with error ->"), error);

        this.announce(DiscordWebhookAnnounceType.CrashBot)
            .then(() => process.exit(1));
    }

    /**
     * Initiate a zero-downtime restart.
     */
    public async restart(): Promise<void> {
        this.manager!.queue.options.auto = true;
        const before: number = Date.now();

        await this.manager!.recluster!.start({
            restartMode: "gracefulSwitch",
            delay: 3 * 1000
        });
    
        const time: number = Date.now() - before;
        this.app.logger.info("It took", chalk.bold(`${(time / 1000).toFixed(2)}s`), "for", chalk.bold(this.clusters.size), `cluster${this.clusters.size > 1 ? "s" : ""} to be reloaded.`)

        await this.announce(DiscordWebhookAnnounceType.ReloadBot);
        this.manager!.queue.options.auto = false;

    }

    public async fetchSession(): Promise<BotDataSessionLimit> {
        const raw: {
            session_start_limit: { max_concurrency: number, remaining: number, total: number }
        } = await this.rest.get(Routes.gatewayBot()) as any;

        return {
            maxConcurrency: raw.session_start_limit.max_concurrency,
            remaining: raw.session_start_limit.remaining,
            total: raw.session_start_limit.total
        };
    }

    public async startQueue(): Promise<void> {
        this.manager!.spawn({
            timeout: -1
        })
			.catch(error => {
				this.app.logger.error(`Failed to set up cluster manager ->`, error);
				this.app.stop(1);
			});

        
        await delay(2000);
            
        /* Current shard counter */
        let counter: number = 0;

        /* Shard reset timer */
        const resetTimer: NodeJS.Timer = setInterval(() => {
            counter = 0;
        }, 15 * 1000);

        for (let i = 0; i < this.manager!.totalClusters; i++) {
            /* Increment the current shard counter. */
            counter += this.manager!.shardsPerClusters ?? this.app.config.shardsPerCluster;

            /* Spawn the next cluster. */
            if (this.app.config.dev) this.app.logger.debug(`Spawning cluster ${chalk.bold(`#${i + 1}`)} ...`);
            await this.manager!.queue.next();

            if (counter >= this.session!.maxConcurrency) await delay(7500);
            else await delay(3000);
        }

        clearInterval(resetTimer);
    }

    /**
     * Set up the cluster sharding manager.
     */
    public async setup(): Promise<void> {
        const now: number = Date.now();

        /* Set up the Discord REST API client. */
        this.rest = new REST({
            version: "10",
            rejectOnRateLimit: [ "/gateway" ]
        }).setToken(this.app.config.discord.token);

        /* Set up the crash handler. */
        process.on("unhandledRejection", reason => this.crashed(reason as Error));
        process.on("uncaughtException", error => this.crashed(error));

        /* Initialize the cluster sharding manager. */
        this.manager = new ClusterManager("build/bot/bot.js", {
            totalClusters: this.app.config.clusters as number | "auto",
            shardsPerClusters: typeof this.app.config.shardsPerCluster === "string" ? undefined : this.app.config.shardsPerCluster,

            token: this.app.config.discord.token,
            
            mode: "worker",
            respawn: true,
            
            restarts: {
                interval: 60 * 60 * 1000,
                max: 999
            },

            queue: {
                auto: false
            }
        }) as BotClusterManager;

        this.manager.extend(
            new ReClusterManager()
        );

        /* Add this manager instance to the cluster manager. */
        this.manager.bot = this;

        /* Set up event handling. */
        this.manager.on("clusterCreate", cluster => this.onCreate(cluster));
        if (this.app.config.dev) this.manager.on("debug", line => this.app.logger.debug(line));

        /* Fetch the /gateway/bot session limit. */
        await this.fetchSession()
            .then(session => this.session = session)
			.catch(error => {
				this.app.logger.error(`Failed to fetch Discord session limit ->`, error);
				this.app.stop(1);
			});

        /* Launch the actual sharding manager. */
        await this.startQueue()
            .catch(error => {
                this.app.logger.error(`Failed to start clusters in queue ->`, error);
                this.app.stop(1);
            });

        /* Calculate, how long it took to start all clusters. */
        const time: number = Date.now() - now;

        /* Emit to all clusters that the starting process is over. */
        await this.sendDone();

        this.app.logger.debug(`It took ${chalk.bold(`${(time / 1000).toFixed(2)}s`)} for ${`${chalk.bold(this.clusters.size)} cluster${this.clusters.size > 1 ? "s" : ""}`} to be initialized.`);
        this.app.logger.info("Up n' running!");

        if (!this.app.config.dev) await this.announce(DiscordWebhookAnnounceType.StartBot);
        this.started = true;
    }
}