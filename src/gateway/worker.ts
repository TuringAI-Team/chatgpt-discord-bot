import dotenv from "dotenv";
dotenv.config();

import type { DiscordGatewayPayload, DiscordGuild, DiscordReady, DiscordUnavailableGuild, Intents } from "discordeno";
import { parentPort, workerData } from "worker_threads";
import { createLogger } from "discordeno/logger";
import { createShardManager } from "discordeno";
import amqplib from "amqplib";

import type { ManagerMessage } from "./index.js";
import { RABBITMQ_URI } from "../config.js";

if (!parentPort) throw new Error("Parent port is null");

const parent = parentPort!;
const data: WorkerCreateData = workerData;

const log = createLogger({ name: `[WORKER #${data.workerID}]` });

const identifyPromises = new Map<number, () => void>();

let channel: amqplib.Channel | undefined;

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

	handleMessage: async (shard, message) => {
		if (!message.t) return;

		if (message.t === "READY") {
			/* Marks which guilds the bot is in, when doing initial loading in cache. */
			(message.d as DiscordReady).guilds.forEach((g) => loadingGuilds.add(BigInt(g.id)));
			log.info(`Shard #${shard.id} is ready`);
		}

		// If GUILD_CREATE event came from a shard loaded event, change event to GUILD_LOADED_DD.
		if (message.t === "GUILD_CREATE") {
			const guild = message.d as DiscordGuild;
			const id = BigInt(guild.id);

			const existing = guilds.has(id);
			if (existing) return;

			if (loadingGuilds.has(id)) {
				message.t = "GUILD_LOADED_DD" as any;
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

        if (!channel) return;

        channel.publish("gateway", "", Buffer.from(JSON.stringify({
			shard: shard.id, data: message
		} as GatewayMessage)), {
            contentType: "application/json"
        });
	},

	requestIdentify: async function (id: number) {
		return await new Promise((resolve) => {
			identifyPromises.set(id, resolve);

			const identifyRequest: ManagerMessage = {
				type: "REQUEST_IDENTIFY",
				shardID: id
			};

			parent.postMessage(identifyRequest);
		});
	}
});

parent.on("message", async (data: WorkerMessage) => {
	switch (data.type) {
		case "IDENTIFY_SHARD": {
			log.info(`Starting to identify #${data.shardID}`);
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

export type WorkerMessage = WorkerIdentifyShard | WorkerAllowIdentify

export interface WorkerIdentifyShard {
	type: "IDENTIFY_SHARD";
	shardID: number;
}

export interface WorkerAllowIdentify {
	type: "ALLOW_IDENTIFY";
	shardID: number;
}

export interface WorkerCreateData {
	intents: Intents;
	token: string;
	path: string;
	totalShards: number;
	workerID: number;
}

export interface GatewayMessage {
	data: DiscordGatewayPayload;
	shard: number;
}

async function connectRabbitMQ() {
	let connection: amqplib.Connection;

	try {
		connection = await amqplib.connect(RABBITMQ_URI);
	} catch (error) {
		log.error(error);
		throw error;
	}
	try {
		channel = await connection.createChannel();
		await channel.assertExchange("gateway", "direct");
	} catch (error) {
		log.error(error);
		channel = undefined;
	}
};

await connectRabbitMQ();