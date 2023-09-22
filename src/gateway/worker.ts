import {
	Camelize,
	DiscordGatewayPayload,
	DiscordGuild,
	DiscordReady,
	DiscordUnavailableGuild,
	DiscordenoShard,
	ShardGatewayConfig,
	ShardSocketRequest,
	ShardState,
	createLogger,
} from "@discordeno/bot";
import { Connection } from "rabbitmq-client";
import { parentPort, workerData } from "worker_threads";
import config from "../config.js";
import type { ShardInfo } from "../types/other.js";
import { MessageFromWorker } from "./manager.js";

if (!parentPort) {
	throw new Error("Parent port is null");
}

const script: WorkerCreateData = workerData;
const logger = createLogger({ name: `[WORKER #${script.workerId}]` });

const identifys = new Map<number, () => void>();

const guilds: Set<string> = new Set();
const loads: Set<string> = new Set();

const manager = new Map<number, DiscordenoShard>();

const connection = new Connection(config.rabbitmq.uri);
const publisher = connection.createPublisher();

setInterval(() => {
	for (const shard of manager.values()) {
		if (shard.state === ShardState.Connected) continue;
		shard.identify();
		logger.info(`Shard ${shard.id} re-identifying`);
	}
}, 6e4);

parentPort.on("message", parentListener);

async function parentListener(data: WorkerMessage) {
	switch (data.type) {
		case "IDENTIFY_SHARD": {
			logger.info(`Start to identify shard #${data.shardId}`);
			if (manager.has(data.shardId)) return logger.warn("Shard already exist");
			const shard = new DiscordenoShard({
				id: data.shardId,
				events: {
					message: handleMessage,
				},
				connection: data.connection,
			});
			shard.forwardToBot = (payload) => shard.events.message?.(shard, payload);

			shard.shardIsReady = async () => {
				const request: MessageFromWorker = { type: "SHARD_ON", shardId: shard.id };
				parentPort?.postMessage(request);
			};

			manager.set(shard.id, shard);

			await shard.identify();
			break;
		}
		case "ALLOW_IDENTIFY":
			identifys.get(data.shardId)?.();
			identifys.delete(data.shardId);
			break;
		case "SHARD_PAYLOAD":
			manager.get(data.shardId)?.send(data.data);
			break;
	}
}

async function handleMessage(shard: DiscordenoShard, message: Camelize<DiscordGatewayPayload>) {
	logger.debug(`Got event ${message.t ?? "Heartbeat"} (${message.op}) in Shard #${shard.id}`);

	handleInternalEvent(message);

	switch (message.t) {
		case "READY":
		case "RESUMED":
		case "GUILD_CREATE":
		case "GUILD_DELETE":
		case "MESSAGE_CREATE":
		case "INTERACTION_CREATE":
			await publisher.send({ routingKey: "gateway" }, { shardId: shard.id, payload: message });
	}
}

export function handleInternalEvent(message: Camelize<DiscordGatewayPayload>) {
	switch (message.t) {
		case "READY":
			for (const guild of (message.d as DiscordReady).guilds) {
				loads.add(guild.id);
			}
			break;
		case "GUILD_CREATE": {
			const guild = message.d as DiscordGuild;
			if (guilds.has(guild.id)) return;
			if (loads.has(guild.id)) {
				message.t = "GUILD_LOADED" as never;
				loads.delete(guild.id);
			}
			guilds.add(guild.id);
			break;
		}
		case "GUILD_DELETE": {
			const guild = message.d as DiscordUnavailableGuild;
			if (guild.unavailable) return;
			guilds.delete(guild.id);
			break;
		}
	}
}

setInterval(
	(shards, pub) => {
		const data: ShardInfo[] = [...shards.values()].map((s) => ({
			id: s.id,
			workerId: script.workerId,
			state: s.state,
			rtt: s.heart.rtt ?? -1,
		}));

		pub.send({ routingKey: "gateway" }, { payload: { d: data, t: "SHARD_INFO" } });
	},
	6e5,
	manager,
	publisher,
);

export interface WorkerShardInfo {
	workerId: number;
	shardId: number;
	rtt: number;
	state: ShardState;
}

export type WorkerMessage = WorkerIdentifyShard | WorkerAllowIdentify | WorkerShardPayload;
export interface WorkerIdentifyShard {
	type: "IDENTIFY_SHARD";
	shardId: number;
	connection: ShardGatewayConfig;
}

export interface WorkerAllowIdentify {
	type: "ALLOW_IDENTIFY";
	shardId: number;
}

export interface WorkerShardPayload {
	type: "SHARD_PAYLOAD";
	shardId: number;
	data: ShardSocketRequest;
}

export interface WorkerCreateData {
	intents: number;
	token: string;
	path: string;
	totalShards: number;
	workerId: number;
}
