export type ManagerMessage = ManagerMessageRequestIdentify | ManagerMessageReady

export interface ManagerMessageRequestIdentify {
	type: "REQUEST_IDENTIFY";
	shardID: number;
}

export interface ManagerMessageReady {
	type: "READY";
	shardID: number;
}