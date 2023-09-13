import { CreateApplicationCommand, createBot } from "@discordeno/bot";
import { createRestManager } from "@discordeno/rest";
import { createLogger } from "@discordeno/utils";
import {
	BOT_TOKEN,
	INTENTS,
	REDIS_HOST,
	REDIS_PASSWORD,
	REDIS_PORT,
	REDIS_USER,
	RABBITMQ_URI,
	GATEWAY_URL,
	GATEWAY_AUTH,
} from "../config.js";
import { createClient } from "redis";
import { Connection } from "rabbitmq-client";
import API from "./api.js";
import { events } from "./events/index.js";
import { handleGatewayMessage } from "./gateway.js";
import { commands } from "./commands/index.js";

const connection = new Connection(RABBITMQ_URI);

export const bot = createBot({
	token: BOT_TOKEN,
	intents: INTENTS,
	events,
});

const client = createClient({
	socket: {
		host: REDIS_HOST,
		port: REDIS_PORT,
	},

	username: REDIS_USER,
	password: REDIS_PASSWORD,
});

await client.connect();
bot.redis = client;
bot.logger = createLogger({ name: "[BOT]" });
bot.api = API;
bot.rest = createRestManager({
	token: BOT_TOKEN,
});

// @ts-expect-error remove the expect error and see the magic of typescript errors
bot.gateway.requestMembers = async (guildId, options) => {
	await fetch(GATEWAY_URL, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: GATEWAY_AUTH,
		},
		body: JSON.stringify({ type: "REQUEST_MEMBERS", guildId, options }),
	})
		.then((res) => res.text())
		.catch((err) => bot.logger.error(err));
};

const applicationCommands: CreateApplicationCommand[] = Array.from(commands.values()).map(({ execute, ...rest }) => rest);

await bot.rest.upsertGlobalApplicationCommands(applicationCommands);
bot.transformers.desiredProperties.interaction.data = true;
bot.transformers.desiredProperties.interaction.type = true;
bot.transformers.desiredProperties.interaction.channelId = true;
bot.transformers.desiredProperties.interaction.guildId = true;
bot.transformers.desiredProperties.interaction.guildLocale = true;
bot.transformers.desiredProperties.interaction.message = true;
bot.transformers.desiredProperties.interaction.member = true;
bot.transformers.desiredProperties.interaction.user = true;
bot.transformers.desiredProperties.interaction.token = true;
bot.transformers.desiredProperties.interaction.applicationId = true;
bot.transformers.desiredProperties.interaction.id = true;

bot.logger.info("Bot started");

connection.createConsumer(
	{
		queue: "gateway",
	},
	(message) => {
		try {
			const { payload, shardId } = message.body;

			if (payload?.t) handleGatewayMessage(bot, payload, shardId);
		} catch (error: unknown) {
			bot.logger.error(error);
		}
	},
);
