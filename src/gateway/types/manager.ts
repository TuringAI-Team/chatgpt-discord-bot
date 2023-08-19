export type ManagerMessage = ManagerMessageRequestIdentify

export interface ManagerMessageRequestIdentify {
	type: "REQUEST_IDENTIFY";
	shardID: number;
}