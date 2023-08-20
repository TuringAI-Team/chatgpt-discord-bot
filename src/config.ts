import { Intents } from "discordeno";

import dotenv from "dotenv";
dotenv.config();

/** Token & ID of the bot */
export const BOT_TOKEN = process.env.BOT_TOKEN!;
export const BOT_ID = process.env.BOT_ID!;

/** Load distribution */
export const TOTAL_WORKERS = Number(process.env.TOTAL_WORKERS!);
export const SHARDS_PER_WORKER = Number(process.env.SHARDS_PER_WORKER!);

/** REST server */
export const REST_URL = `${process.env.REST_HOST}:${process.env.REST_PORT}`;
export const REST_PORT = process.env.REST_PORT!;

/** Authentication for the HTTP services */
export const HTTP_AUTH = process.env.HTTP_AUTH!;

/** RabbitMQ server URI */
export const RABBITMQ_URI = process.env.RABBITMQ_URI!;

/** Redis connection */
export const REDIS_HOST = process.env.REDIS_HOST!;
export const REDIS_USER = process.env.REDIS_USER;
export const REDIS_PASSWORD = process.env.REDIS_PASSWORD;
export const REDIS_PORT = process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined;

/** Supabase authentication */
export const DB_URL = process.env.DB_URL!;
export const DB_KEY = process.env.DB_KEY!;

/** Turing API keys */
export const TURING_API_KEY = process.env.TURING_API_KEY!;
export const TURING_CAPTCHA_KEY = process.env.TURING_CAPTCHA_KEY!;
export const TURING_SUPER_KEY = process.env.TURING_SUPER_KEY!;

/** How often to save database changes, in seconds */
export const DB_QUEUE_INTERVAL = Number(process.env.DB_QUEUE_INTERVAL!);

/** Support server invite code */
export const SUPPORT_INVITE = `discord.gg/${process.env.SUPPORT_INVITE_CODE!}`;

/* Color to use for most embeds */
export const BRANDING_COLOR = parseInt(process.env.BRANDING_COLOR!, 16);

/** Which gateway intents should be used */
export const INTENTS: Intents =
    Intents.DirectMessages |
    Intents.GuildMessages;