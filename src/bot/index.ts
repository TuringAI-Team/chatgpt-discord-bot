import { CreateApplicationCommand, createBot } from "@discordeno/bot";
import { createRestManager } from "@discordeno/rest";
import { createLogger } from "@discordeno/utils";
import axios from "axios";
import { Connection } from "rabbitmq-client";
import { createClient } from "redis";
import { BOT_TOKEN, GATEWAY_AUTH, GATEWAY_URL, INTENTS, RABBITMQ_URI, REDIS_HOST, REDIS_PASSWORD, REDIS_PORT, REDIS_USER } from "../config";
import API from "./api";
import { events } from "./events/index";
import { handleGatewayMessage } from "./gateway";
import { loadCommands } from "./handlers";
import { Command } from "./types";

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

export const logger = createLogger({ name: "[BOT]" });

await client.connect();
bot.redis = client;
bot.logger = logger;
bot.api = API;
bot.rest = createRestManager({
	token: BOT_TOKEN,
});

const cmds = await loadCommands();
const applicationCommands: CreateApplicationCommand[] = cmds.map((cmd) => cmd.body);
export const commands = new Map<string, Command>(cmds.map((cmd) => [cmd.body.name, cmd]));
await bot.rest.upsertGlobalApplicationCommands(applicationCommands).catch((err) => logger.warn(err));
logger.info(`${commands.size} commands deployed`);

// @ts-expect-error remove the expect error and see the magic of typescript errors
bot.gateway.requestMembers = async (guildId, options) => {
	await axios
		.post(GATEWAY_URL, {
			headers: {
				Authorization: GATEWAY_AUTH,
			},
			body: JSON.stringify({ type: "REQUEST_MEMBERS", guildId, options }),
		})
		.catch((err) => bot.logger.error(err));
};

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
