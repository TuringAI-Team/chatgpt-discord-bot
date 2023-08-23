import dotenv from "dotenv";
dotenv.config();

import { ActivityTypes, DiscordGuild, DiscordMessage, DiscordReady, DiscordUnavailableGuild } from "discordeno";
import { parentPort, workerData } from "worker_threads";
import { createLogger } from "discordeno/logger";
import { createShardManager } from "discordeno";
import RabbitMQ from "rabbitmq-client";

import type { WorkerCreateData, WorkerMessage } from "./types/worker.js";

import { RABBITMQ_URI } from "../config.js";

if (!parentPort) throw new Error("Parent port is null");

const parent = parentPort!;
const data: WorkerCreateData = workerData;

const logger = createLogger({ name: `[WORKER #${data.workerID}]` });
const identifyPromises = new Map<number, () => void>();

const connection = new RabbitMQ.Connection(RABBITMQ_URI);
const publisher = connection.createPublisher();

/* Store loading guild & guild IDs to change GUILD_CREATE to GUILD_LOADED_DD, if needed. */
const loadingGuilds: Set<bigint> = new Set();
const guilds: Set<bigint> = new Set();

const manager = createShardManager({
	gatewayConfig: {
		intents: data.intents,
		token: data.token
	},

	totalShards: data.totalShards,
	shardIds: [],

	createShardOptions: {
		makePresence: () => ({
			status: "online",

			activities: [
				{
					type: ActivityTypes.Game,
					name: ".gg/turing » @ChatGPT",
					createdAt: Date.now()
				}
			]
		})
	},

	handleMessage: async (shard, message) => {
		if (!message.t) return;

		if (message.t === "READY") {
			/* Marks which guilds the bot is in, when doing initial loading in cache. */
			(message.d as DiscordReady).guilds.forEach((g) => loadingGuilds.add(BigInt(g.id)));
			
			parent.postMessage({
				type: "READY",
				shardID: shard.id
			});
		}

		// If GUILD_CREATE event came from a shard loaded event, change event to GUILD_LOADED_DD.
		if (message.t === "GUILD_CREATE") {
			const guild = message.d as DiscordGuild;
			const id = BigInt(guild.id);

			const existing = guilds.has(id);
			if (existing) return;

			if (loadingGuilds.has(id)) {
				message.t = "GUILD_CREATE";
				loadingGuilds.delete(id);
			}

			guilds.add(id);
		}

		/* If a guild gets deleted, remove it from the cache so GUILD_CREATE works properly later. */
		if (message.t === "GUILD_DELETE") {
			const guild = message.d as DiscordUnavailableGuild;
			if (guild.unavailable) return;

			guilds.delete(BigInt(guild.id));
		}

		switch (message.t) {
			case "MESSAGE_CREATE":
			case "INTERACTION_CREATE":
				if (message.t === "MESSAGE_CREATE" && (message.d as DiscordMessage).content?.length === 0) return;

				await publisher.send("gateway", {
					shard: shard.id, data: message
				});

				break;

			default:
				break;
		}
	},

	requestIdentify: async function (id: number) {
		return await new Promise((resolve) => {
			identifyPromises.set(id, resolve);

			parent.postMessage({
				type: "REQUEST_IDENTIFY",
				shardID: id
			});
		});
	}
});

parent.on("message", async (data: WorkerMessage) => {
	switch (data.type) {
		case "IDENTIFY_SHARD": {
			logger.info(`Starting to identify shard #${data.shardID}`);
			await manager.identify(data.shardID);

			break;
		}

		case "ALLOW_IDENTIFY": {
			identifyPromises.get(data.shardID)?.();
			identifyPromises.delete(data.shardID);

			break;
		}
	}
});