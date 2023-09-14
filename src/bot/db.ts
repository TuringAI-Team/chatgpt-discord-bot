import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import RabbitMQ from "rabbitmq-client";
import { createClient as createRedisClient } from "redis";
import { DB_KEY, DB_URL, RABBITMQ_URI, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USER } from "../config.js";
import { logger } from "./index";

import { CollectionName } from "../types/collections";
/** Redis client */
const redis = createRedisClient({
    socket: {
        host: REDIS_HOST,
        port: REDIS_PORT,
    },

    username: REDIS_USER,
    password: REDIS_PASSWORD,
});

/** Supabase client */
const db = createSupabaseClient(DB_URL, DB_KEY, {
    auth: {
        persistSession: false,
    },
});

/** RabbitMQ connection */
const connection = new RabbitMQ(RABBITMQ_URI);
const publisher = connection.createPublisher();
async function sendQuery(body: NonNullable<unknown>) {
    await publisher.send("db", body);
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

export function getCollectionKey(collection: CollectionName, id: string) {
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
    if (params.id) {
        const collectionKey = getCollectionKey(params.collection, params.id);
        const existing = await getCache(collectionKey);
        if (existing) return existing;
        const result = await db.from(params.collection).select("*").eq("id", params.id).single();
        if (!result) return null;
        await setCache(collectionKey, result);
        return result;
    } else if (params.filter) {
        const result = await db.from(params.collection).select("*").match(params.filter);
        return result;
    } else {
        const result = await db.from(params.collection).select("*");
        return result;
    }
}

export async function env(
    guildId: string,
    userId: string,
) {

}

export async function premium(
    guildId: string,
    userId: string,
) {

}

/**
 * Cuando tengas esto avisa
 * https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/ddeno/src/bot/db.ts esto parece copilot
 * tambien los utils, como premium ?, env ?, etc
 *  https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/e7ce6c62e26281bb03760e43dce444248263acfe/src/bot/db.ts#L113 el env es que me das una id de usuario y una de guild y te devuelvo el env que son los objetos?:
 * y el premium que es? https://github.com/TuringAI-Team/chatgpt-discord-bot/blob/e7ce6c62e26281bb03760e43dce444248263acfe/src/bot/db.ts#L56
 */

export async function remove(
    collection: CollectionName,
    id: string,
) {
    const result = await sendQuery({
        type: "remove",
        collection,
        id,
    });
    return result;
}
