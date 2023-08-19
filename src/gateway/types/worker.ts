import type { DiscordGatewayPayload, Intents } from "discordeno";

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