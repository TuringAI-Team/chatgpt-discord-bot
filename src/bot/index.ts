import { CreateApplicationCommand, createBot } from "@discordeno/bot";

export const bot = createBot({
	token: config.bot.token,
	intents: config.gateway.intents,
	events,
});

import { createRestManager } from "@discordeno/rest";
import { createLogger } from "@discordeno/utils";
import config from "../config.js";
import API from "./api.js";
import { Buttons } from "./buttons/index.js";
import { commands as cmds } from "./commands/index.js";
import { events } from "./events/index.js";
import { handleGatewayMessage } from "./gateway.js";
import type { ButtonResponse, Command } from "./types/index.js";
import { connection, env, redis } from "./utils/db.js";
import { oldSettingsMigration } from "./utils/settings.js";
export const logger = createLogger({ name: "[BOT]" });
let routingKey = "gateway";
if (config.bot.dev) {
	logger.info("Running in dev mode");
	routingKey += ":dev";
	const envrionment = await env("530102778408861706");
	if (!envrionment) throw new Error("no envrionment");
	const user = envrionment.user;
	console.log(await oldSettingsMigration(user));
} else {
	logger.info("Running in prod mode");
}
//getDefaultSettings(true);
/*
const client = createClient({
	socket: {
		host: config.database.redis.host,
		port: config.database.redis.port,
	},

	password: config.database.redis.password,
});
console.log("pre commands redis ");

await client.connect();*/
bot.redis = redis;
bot.logger = logger;
bot.shards = new Map();
bot.pages = new Map();
bot.api = API;
bot.rest = createRestManager({
	token: config.bot.token,
	applicationId: config.bot.id,
});

export const gatewayConfig = await bot.rest.getGatewayBot();

console.log("post gateway // pre commands");

console.log("post commands // pre create commands");

const applicationCommands: CreateApplicationCommand[] = cmds.map((cmd) => cmd.body);
export const commands = new Map<string, Command>(cmds.map((cmd) => [cmd.body.name, cmd]));
export const buttons = new Map<string, ButtonResponse>(Buttons.map((b) => [b.id, b]));

console.log("post create commands // pre upsert");

await bot.rest.upsertGlobalApplicationCommands(applicationCommands).catch((err) => logger.warn(err));

console.log("post upsert");

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
bot.transformers.desiredProperties.user.id = true;
bot.transformers.desiredProperties.user.username = true;
bot.transformers.desiredProperties.user.discriminator = true;
bot.transformers.desiredProperties.user.avatar = true;
bot.transformers.desiredProperties.user.bot = true;
bot.transformers.desiredProperties.user.globalName = true;
bot.transformers.desiredProperties.user.flags = true;
bot.transformers.desiredProperties.user.publicFlags = true;
bot.transformers.desiredProperties.user.locale = true;
bot.transformers.desiredProperties.user.verified = true;
bot.transformers.desiredProperties.message.channelId = true;
bot.transformers.desiredProperties.message.guildId = true;
bot.transformers.desiredProperties.message.member = true;
bot.transformers.desiredProperties.message.mentions = true;
bot.transformers.desiredProperties.message.reactions = true;
bot.transformers.desiredProperties.message.thread = true;
bot.transformers.desiredProperties.message.type = true;
bot.transformers.desiredProperties.message.author = true;
bot.transformers.desiredProperties.message.content = true;
bot.transformers.desiredProperties.message.id = true;
bot.transformers.desiredProperties.message.webhookId = true;
bot.transformers.desiredProperties.message.attachments = true;
bot.transformers.desiredProperties.message.interaction.member = true;
bot.transformers.desiredProperties.message.interaction.user = true;
bot.transformers.desiredProperties.message.interaction.id = true;
bot.transformers.desiredProperties.message.interaction.name = true;
bot.transformers.desiredProperties.message.components = true;
bot.transformers.desiredProperties.message.embeds = true;

console.log("pre rabbitmq queue");

connection.createConsumer(
	{
		queue: routingKey,
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

console.log("post rabbit mq queue // THE BOT SHOULD BE UP");

process.on("unhandledRejection", (...args) => logger.warn(...args));
