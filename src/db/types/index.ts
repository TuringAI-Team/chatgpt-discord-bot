import { type DBUser } from "./user.js";

export type CollectionName = "users" | "guilds";
export const CollectionNames: CollectionName[] = [ "users", "guilds" ];

export type DBType = DBUser;

export type DBObject = {
	id: string;
} & Record<string, any>

export type DBRequestType = "get" | "fetch" | "update" | "delete"

export type DBRequestData = DBRequestGet | DBRequestFetch | DBRequestUpdate | DBRequestDelete

interface DBRequestGet {
	type: "get";

	collection: CollectionName;
	id: string;
}

interface DBRequestFetch {
	type: "fetch";

	collection: CollectionName;
	id: string;
}

export interface DBRequestUpdate {
	type: "update";

	collection: CollectionName;
	id: string;
	updates: Record<string, any>;
}

interface DBRequestDelete {
	type: "delete";

	collection: CollectionName;
	id: string;
}

export type DBResponse = {
	success: boolean;
	error?: string;
	data: any;
}