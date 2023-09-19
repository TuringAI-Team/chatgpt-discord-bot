import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import RabbitMQ from "rabbitmq-client";
import { createClient as createRedisClient } from "redis";
import config from "../../config.js";
import { logger } from "../index.js";

import { CollectionName, CollectionNames } from "../../types/collections.js";
import { Environment } from "../../types/other.js";
import { Role, User } from "../../types/models/users.js";
import { Guild } from "../../types/models/guilds.js";
import { getSettingsValue } from "./settings.js";

let queue = "db";
if (process.env.NODE_ENV === "development") queue = "db-dev";
/** Redis client */
const redis = createRedisClient({
	socket: {
		host: config.database.redis.host,
		port: config.database.redis.port,
	},

	password: config.database.redis.password,
});

/** Supabase client */
const db = createSupabaseClient(config.database.supabase.url, config.database.supabase.key, {
	auth: {
		persistSession: false,
	},
});

/** RabbitMQ connection */
const connection = new RabbitMQ.Connection(config.rabbitmq.uri);

const publisher = connection.createPublisher();
async function sendQuery(body: NonNullable<unknown>) {
	await publisher.send(queue, body);
}

/** Cache */
async function setCache<T>(key: string, data: T) {
	await redis.set(key, JSON.stringify(data), {
		EX: 30 * 60,
	});
}

export async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = (await redis.get(key)) ?? null;

	if (existing !== null) return JSON.parse(existing);
	else return null;
}

export function getCollectionKey(collection: string, id: string) {
	return `${collection}::${id}`;
}

/** Actions */

export async function update(collection: CollectionName, id: string, data: NonNullable<unknown>) {
	const body = {
		type: "update",
		collection,
		id,
		data,
	};
	const result = await sendQuery(body);
	return result;
}

export async function insert(collection: CollectionName, data: NonNullable<unknown>, id?: string) {
	let body: {
		type: "insert";
		collection: CollectionName;
		data: NonNullable<unknown>;
		id?: string;
	} = {
		type: "insert",
		collection,
		data,
	};
	if (id) body = { ...body, id };
	const result = await sendQuery(body);
	return result;
}

export type GetParams<T = string | undefined> = {
	collection: CollectionName;
	id: T;
	filter?: Array<{
		column: string;
		operator: string;
		value: string;
	}>;
};

export async function get(params: GetParams): Promise<NonNullable<unknown>>;
export async function get(params: GetParams<string>): Promise<NonNullable<unknown>>;
export async function get(params: GetParams | GetParams<string>) {
	let collection: string = params.collection;
	if (CollectionNames[params.collection]) collection = CollectionNames[params.collection];

	if (params.id) {
		const collectionKey = getCollectionKey(params.collection, params.id);
		const existing = await getCache(collectionKey);
		console.log(`existing  ${JSON.stringify(existing)}`);
		if (existing) return existing;
		const { data: result } = await db.from(collection).select("*").eq("id", params.id).single();
		if (!result) return null;
		await setCache(collectionKey, result);
		return result;
	} else if (params.filter) {
		const { data: result } = await db.from(collection).select("*").match(params.filter);
		return result;
	} else {
		const { data: result } = await db.from(collection).select("*");
		return result;
	}
}

export async function env(userId: string, guildId?: string) {
	let guild: NonNullable<unknown> | null = null;
	const user = await get({
		collection: "users",
		id: userId,
	});
	if (!user) return null;
	if (guildId) {
		guild = await get({
			collection: "guilds",
			id: guildId,
		});
		if (!guild) return null;
	}
	const result = {
		user: user,
		guild: guild,
	} as Environment;
	return result;
}

export function premium(env: Environment): {
	type: "plan" | "subscription";
	location: "user" | "guild";
} | null {
	/* In which order to use the plans in */
	const locationPriority: "guild" | "user" = getSettingsValue(env.user, "premium:location_priority") as "guild" | "user";

	/* Whether to prefer the Premium of the guild or user itself */
	const typePriority: "plan" | "subscription" = getSettingsValue(
		// biome-ignore lint/style/noNonNullAssertion: uh needed
		env.guild ? env[locationPriority]! : env.user,
		"premium:type_priority",
	) as "plan" | "subscription";

	const checks: Record<typeof typePriority, (entry: Guild | User) => boolean> = {
		subscription: (entry) => entry.subscription !== null && Date.now() < entry.subscription.expires,
		plan: (entry) => entry.plan !== null && entry.plan.total > entry.plan.used,
	};

	const locations: typeof locationPriority[] = ["guild", "user"];
	const types: typeof typePriority[] = ["plan", "subscription"];

	if (locationPriority !== locations[0]) locations.reverse();
	if (typePriority !== types[0]) types.reverse();

	for (const type of types) {
		for (const location of locations) {
			const entry = env[location];
			if (!entry) continue;

			if (checks[type](entry))
				return {
					location,
					type,
				};
		}
	}

	return null;
}

export function voted(user: User): number | null {
	if (!user.voted) return null;
	if (Date.now() - Date.parse(user.voted) > 12.5 * 60 * 60 * 1000) return null;

	return Date.parse(user.voted);
}

export async function icon(env: Environment) {
	if (env.user?.roles.includes(Role.Moderator)) return "⚒️";
	const p = premium(env);

	if (p) {
		if (p.type === "plan" && p.location === "user") return "📊";
		if (p.type === "subscription" && p.location === "user") return "✨";
		if (p.location === "guild") return "💫";
	}

	const votedAt = voted(env.user);

	if (votedAt) {
		if (votedAt + 12.5 * 60 * 60 * 1000 - Date.now() < 30 * 60 * 1000) return "📩";
		else return "✉️";
	}

	return "👤";
}

/**
 *
 * Cuando tengas esto avisa
 * https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/ddeno/src/bot/db.ts esto parece copilot
 * tambien los utils, como premium ?, env ?, etc
 *  https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/e7ce6c62e26281bb03760e43dce444248263acfe/src/bot/db.ts#L113 el env es que me das una id de usuario y una de guild y te devuelvo el env que son los objetos?:
 * y el premium que es? https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/e7ce6c62e26281bb03760e43dce444248263acfe/src/bot/db.ts#L56
 */

export async function remove(collection: CollectionName, id: string) {
	const result = await sendQuery({
		type: "remove",
		collection,
		id,
	});
	return result;
}
await redis
	.connect()
	.then(() => {
		logger.info("Redis connected");
	})
	.catch((error) => {
		console.error(error);
	});
