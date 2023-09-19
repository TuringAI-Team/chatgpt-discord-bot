import { CreateApplicationCommand, createBot } from "@discordeno/bot";
import { createRestManager } from "@discordeno/rest";
import { createLogger } from "@discordeno/utils";
import { Connection } from "rabbitmq-client";
import { createClient } from "redis";
import config from "../config.js";
import API from "./api.js";
import { events } from "./events/index.js";
import { handleGatewayMessage } from "./gateway.js";
import { loadCommands } from "./handlers/index.js";
import { Command } from "./types/index.js";

export const logger = createLogger({ name: "[BOT]" });
const connection = new Connection(config.rabbitmq.uri);

export const bot = createBot({
	token: config.bot.token,
	intents: config.gateway.intents,
	events,
});

const client = createClient({
	socket: {
		host: config.database.redis.host,
		port: config.database.redis.port,
	},

	password: config.database.redis.password,
});

await client.connect();
bot.redis = client;
bot.logger = logger;
bot.api = API;
bot.rest = createRestManager({
	token: config.bot.token,
});

const cmds = await loadCommands();
const applicationCommands: CreateApplicationCommand[] = cmds.map((cmd) => cmd.body);
export const commands = new Map<string, Command>(cmds.map((cmd) => [cmd.body.name, cmd]));
await bot.rest.upsertGlobalApplicationCommands(applicationCommands).catch((err) => logger.warn(err));
logger.info(`${commands.size} commands deployed`);

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
