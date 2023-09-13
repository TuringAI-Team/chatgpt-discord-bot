export type ManagerMessage = ManagerMessageRequestIdentify | ManagerMessageReady | ManagerMessageShardPayload;

export interface ManagerMessageRequestIdentify {
	type: "REQUEST_IDENTIFY";
	shardId: number;
}

export interface ManagerMessageReady {
	type: "READY";
	shardId: number;
}

export interface ManagerMessageShardPayload {
	type: "SHARD_PAYLOAD";
	payload: unknown;
}

export type ManagerHTTPRequest = ManagerHTTPShardPayload;

export interface ManagerHTTPShardPayload {
	type: "SHARD_PAYLOAD";
	payload: unknown;
}
