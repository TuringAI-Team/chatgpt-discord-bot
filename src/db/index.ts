import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient as createRedisClient } from "redis";
import { createLogger } from "discordeno/logger";
import RabbitMQ from "rabbitmq-client";

import { DB_KEY, DB_QUEUE_INTERVAL, DB_URL, RABBITMQ_URI, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USER } from "../config.js";
import { CollectionName, CollectionNames, DBObject, DBRequestData } from "./types/index.js";
import { DBGuild } from "./types/guild.js";
import { DBUser } from "./types/user.js";

const logger = createLogger({ name: "[DB]" });

/**
 * Collection name -> actual DB name map
 * TODO: Clean up DB & fix names
 */
const CollectionNameMap: Record<CollectionName, string> = {
	guilds: "guilds_new",
	users: "users_new"
};

/** Collection templates */
const CollectionTemplates: Record<CollectionName, (id: string) => DBObject> = {
	guilds: id => (({
		id,
		created: new Date().toISOString(),
		subscription: null, plan: null,
		settings: {}, metadata: {},
		infractions: []
	}) as DBGuild),

	users: id => (({
		id,
		created: new Date().toISOString(),
		interactions: {}, voted: null,
		subscription: null, plan: null,
		settings: {}, metadata: {},
		infractions: [], roles: []
	}) as DBUser)
};

/** Update queue */
const queue: Record<CollectionName, Record<string, DBObject>> = {} as any;

for (const type of CollectionNames) {
	queue[type] = {};
}

/** Redis client */
const redis = createRedisClient({
	socket: {
		host: REDIS_HOST,
		port: REDIS_PORT
	},

	username: REDIS_USER,
	password: REDIS_PASSWORD
});

/** Supabase client */
const db = createSupabaseClient(DB_URL, DB_KEY, {
	auth: {
		persistSession: false
	}
});

/** RabbitMQ connection */
const connection = new RabbitMQ.Connection(RABBITMQ_URI);

async function getCache<T>(key: string): Promise<T | null> {
	const existing: string | null = await redis.get(key) ?? null;

	if (existing !== null) return JSON.parse(existing);
	else return null;
}

async function setCache(key: string, data: any) {
	await redis.set(key, JSON.stringify(data)) ?? null;
}

function collectionKey(collection: CollectionName, id: string) {
	return `${collection}-${id}`;
}

async function update<T extends DBObject = DBObject>(
	collection: CollectionName, obj: string | DBObject, updates: Record<string, any>
) {
	const id: string = typeof obj === "string" ? obj : obj.id;

	const queued: T | null = queue[collection][id] as T ?? null;
	let updated: T;

	if (typeof obj === "string") {
		updated = { ...queued, ...updates as T };
	} else {
		updated = { ...obj, ...queued, ...updates as T };
	}

	queue[collection][id] = updated;
	await setCache(collectionKey(collection, id), updated);

	return updated;
}

async function get<T extends DBObject = DBObject>(collection: CollectionName, id: string): Promise<T | null> {
	const existing: T | null = await getCache(collectionKey(collection, id));
	if (existing !== null) return existing;

	const { data } = await db
		.from(CollectionNameMap[collection]).select("*")
		.eq("id", id);

	if (data === null || data.length === 0) return null;
	const entry = data[0];

	await setCache(collectionKey(collection, id), entry);
	return entry as T;
}

async function fetch<T extends DBObject = DBObject>(collection: CollectionName, id: string): Promise<T> {
	const existing = await get<T>(collection, id);
	if (existing) return existing;

	const template = CollectionTemplates[collection](id) as T;
	await setCache(collectionKey(collection, id), template);

	return template;
}

async function handleMessage(data: DBRequestData): Promise<any> {
	if (data.type === "get") {
		return await get(data.collection, data.id);
	} else if (data.type === "fetch") {
		return await fetch(data.collection, data.id);
	} else if (data.type === "update") {
		return await update(data.collection, data.id, data.updates);
	}

	throw new Error("Not implemented");
}

connection.createConsumer({
	queue: "db"
}, async (message, reply) => {
	try {
		const result = await handleMessage(message.body);
		if (result) await reply({ success: true, data: result });
	} catch (error) {
		logger.error(error);

		await reply({
			success: false, error: (error as Error).toString()
		});
	}
});

async function workOnQueue() {
	for (const type of Object.keys(queue) as CollectionName[]) {
		const queued: Record<string, DBObject> = queue[type];
		const entries: [ string, DBObject ][] = Object.entries(queued);

		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const changes: DBObject[] = entries.map(([ _, updated ]) => updated);
		if (changes.length === 0) continue;

		/* Apply the changes to the database. */
		for (const [ index, entry ] of changes.entries()) {
			const id: string = entries[index][0];

			const { error } = await db
				.from(CollectionNameMap[type])
				.upsert(entry, { onConflict: "id" });

			if (error !== null) {
				logger.error(`Failed to to save '${id}' to collection '${type}' ->`, error);
			} else if (error === null) {
				delete queue[type][id];
			}
		}
	}
}

setInterval(async () => {
	await workOnQueue();
}, DB_QUEUE_INTERVAL * 1000);

await redis.connect();
logger.info("Started.");