const { enableHelpersPlugin } = await import("discordeno/helpers-plugin");
import { type Bot, createBot } from "discordeno";
import { createLogger } from "discordeno/logger";
import { createClient } from "redis";
import amqplib from "amqplib";

import { INTENTS, REST_URL, BOT_TOKEN, HTTP_AUTH, RABBITMQ_URI, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_USER } from "../config.js";
import { GatewayMessage } from "../gateway/types/worker.js";

import { setupTransformers } from "./transformers/mod.js";
import { registerCommands } from "./commands/mod.js";
import { setupEvents } from "./events/mod.js";

/* Custom type of the Discordeno bot class, so we can add custom properties */
export type DiscordBot<B extends Bot = Bot> = B & {
	/** An easy-to-use logger to make clean log messages */
	logger: ReturnType<typeof createLogger>;

	/** Redis connection */
	redis: ReturnType<typeof createClient>;
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

	return customized;
}

export const bot = enableHelpersPlugin(
	await customizeBot(
		createBot({
			token: BOT_TOKEN,
			intents: INTENTS,
			
			rest: {
				secretKey: HTTP_AUTH,
				customUrl: REST_URL
			}
		})
	)
);

async function handleGatewayMessage({ data, shard }: GatewayMessage) {
	if (data.t && data.t !== "RESUMED") {
		/* When a guild or something isn't in cache, this will fetch it before doing anything else. */
		if (![ "READY", "GUILD_LOADED_DD" ].includes(data.t)) {
			await bot.events.dispatchRequirements(bot, data, shard);
		}

		bot.handlers[data.t]?.(bot, data, shard);
	}
}

async function connectRabbitMQ() {
	let connection: amqplib.Connection;

	try {
		connection = await amqplib.connect(RABBITMQ_URI);
	} catch (error) {
		console.error(error);
		throw error;
	}

	try {
		const channel = await connection.createChannel();
		await channel.assertExchange("gateway", "direct");

		await channel.assertQueue("gatewayQueue");
		await channel.bindQueue("gatewayQueue", "gateway", "");

		await channel.consume(
			"gatewayQueue",
			async msg => {
				if (msg === null) return;

				const data = JSON.parse(msg.content.toString()) as GatewayMessage;
				await handleGatewayMessage(data);

				channel.ack(msg);
			},

			{ noAck: false }
		);
	} catch (error) {
		console.error(error);
	}
}

await registerCommands();

setupTransformers();
setupEvents();

await connectRabbitMQ();

bot.logger.info("Started.");