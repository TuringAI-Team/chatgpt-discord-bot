import type { Conversation } from "../../bot/types/conversation.js";
import type { DBCampaign } from "./campaign.js";
import type { DBGuild } from "./guild.js";
import type { DBImage } from "./image.js";
import type { DBUser } from "./user.js";

export type CollectionName = "users" | "guilds" | "conversations" | "images" | "campaigns";
export const CollectionNames: CollectionName[] = [ "users", "guilds", "conversations", "images", "campaigns" ];

export type DBType = DBUser | DBGuild | Conversation | DBImage | DBCampaign;

export type DBObject = {
	id: string;
} & Record<string, any>;

export interface DBEnvironment {
	user: DBUser;
	guild: DBGuild | null;
}

export type DBRequestType = "get" | "fetch" | "update" | "delete" | "all";

export type DBRequestData = DBRequestGet | DBRequestFetch | DBRequestUpdate | DBRequestDelete | DBRequestAll;

export interface DBRequestGet {
	type: "get";

	collection: CollectionName;
	id: string;
}

export interface DBRequestFetch {
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

export interface DBRequestDelete {
	type: "delete";

	collection: CollectionName;
	id: string;
}

export interface DBRequestAll {
	type: "all";
	collection: CollectionName;
}

export type DBResponse = {
	success: boolean;
	error?: string;
	data: any;
}