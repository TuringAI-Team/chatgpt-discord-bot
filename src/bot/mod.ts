const { enableHelpersPlugin } = await import("discordeno/helpers-plugin");
import { type Bot, createBot, createRestManager } from "discordeno";
import { createLogger } from "discordeno/logger";
import RabbitMQ from "rabbitmq-client";
import { createClient } from "redis";

import { INTENTS, REST_URL, BOT_TOKEN, HTTP_AUTH, RABBITMQ_URI, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USER } from "../config.js";
import { GatewayMessage } from "../gateway/types/worker.js";

import { setupTransformers } from "./transformers/mod.js";
import { registerCommands } from "./commands/mod.js";
import { setupEvents } from "./events/mod.js";
import { createAPI } from "./api.js";
import { createDB } from "./db.js";

/* Custom type of the Discordeno bot class, so we can add custom properties */
export type DiscordBot<B extends Bot = Bot> = B & {
	/** An easy-to-use logger to make clean log messages */
	logger: ReturnType<typeof createLogger>;

	/** Redis connection */
	redis: ReturnType<typeof createClient>;

	/** Database manager */
	db: Awaited<ReturnType<typeof createDB>>;

	/** Turing API */
	api: ReturnType<typeof createAPI>;
}

async function createRedis() {
	const client = createClient({
		socket: {
			host: REDIS_HOST,
			port: REDIS_PORT
		},

		username: REDIS_USER,
		password: REDIS_PASSWORD
	});

	await client.connect();
	return client;
}

async function customizeBot<B extends Bot = Bot>(bot: B) {
	const customized = bot as unknown as DiscordBot;

	customized.logger = createLogger({ name: "[BOT]" });
	customized.redis = await createRedis();
	customized.db = await createDB();
	customized.api = createAPI();

	return customized;
}

export const bot = enableHelpersPlugin(
	await customizeBot(
		createBot({
			token: BOT_TOKEN,
			intents: INTENTS
		})
	)
);

bot.rest = createRestManager({
	secretKey: HTTP_AUTH,
	customUrl: REST_URL,
	token: BOT_TOKEN
});

async function handleGatewayMessage({ data, shard }: GatewayMessage) {
	if (data.t && data.t !== "RESUMED") {
		/* When a guild or something isn't in cache, this will fetch it before doing anything else. */
		if (![ "READY", "GUILD_LOADED_DD" ].includes(data.t)) {
			await bot.events.dispatchRequirements(bot, data, shard);
		}

		bot.handlers[data.t]?.(bot, data, shard);
	}
}

await registerCommands();

setupTransformers();
setupEvents();

const connection = new RabbitMQ.Connection(RABBITMQ_URI);

connection.createConsumer({
	queue: "gateway"
}, message => {
	handleGatewayMessage(message.body);
});

bot.logger.info("Started.");