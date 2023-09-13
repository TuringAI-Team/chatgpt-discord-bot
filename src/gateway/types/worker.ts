import { DiscordGatewayPayload } from "@discordeno/types";

export type WorkerMessage = WorkerIdentifyShard | WorkerAllowIdentify;

export interface WorkerIdentifyShard {
	type: "IDENTIFY_SHARD";
	shardId: number;
}

export interface WorkerAllowIdentify {
	type: "ALLOW_IDENTIFY";
	shardId: number;
}

export interface WorkerCreateData {
	intents: number;
	token: string;
	path: string;
	totalShards: number;
	workerId: number;
}

export interface GatewayMessage {
	data: DiscordGatewayPayload;
	shard: number;
}
