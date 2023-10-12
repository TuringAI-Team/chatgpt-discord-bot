import { BigString, Bot, Message } from "@discordeno/bot";
import { Environment } from "../../types/other.js";
import { NoCooldown } from "../config/setup.js";
import { commands } from "../index.js";
import { Command } from "../types/command.js";
import { checkCooldown } from "../utils/cooldown.js";
import { env, premium, voted } from "../utils/db.js";

export const MentionRegex = (id: BigString) => new RegExp(`^<@!?${id}>\\s*$`);

export const messageCreate = async (message: Message, bot: Bot) => {
	if (messageBot(message)) return;

	const regex = MentionRegex(bot.id);
	let mentionsBot = message.content.startsWith(`<@${bot.id}>`) || message.content.startsWith(`<@!${bot.id}>`);
	if (!mentionsBot && message.guildId) {
		// message response for only mention
		// @chat-gpt
		console.log("no trigger", message.content, mentionsBot);
		responseInfo(message);
		return;
	}

	const getter = getCommandArgs(message, regex);
	if (!getter) return;
	const [commandName, args] = getter;

	if (!commandName) return;

	const command = commands.get(commandName) ?? commands.get("chat")!;

	if (!command.message) return;

	const environment = await env(message.author.id.toString(), message.guildId?.toString());
	if (!environment) return;

	await bot.helpers.triggerTypingIndicator(message.channelId);

	if (!(await manageCooldown(bot, message, environment, command))) return;

	await command.message({ bot, message, args, env: environment }).catch((err) => {
		bot.logger.error(`There was an error trying to execute the command ${command.body.name}`);
		bot.logger.error("A detailed walkthrough is provided below.");
		bot.logger.error(err);
	});
};

export function messageBot(message: Message) {
	if (!message.content?.length) return true;
	if (message.author.bot || message.webhookId) return true;
	return false;
}

export function getCommandArgs(message: Message, regex: RegExp): [command: string, args: string[]] | undefined {
	const args = message.content
		.trim()
		.split(/ +/)
		.filter((a) => !!a);
	let commandName = args[0];
	if (message.guildId) {
		const mentionIndex = args.findIndex((a) => !!a.match(regex)?.[0]);

		if (mentionIndex < 0) return;
		// 0 or max args for compatibility with arabian
		if (![0, args.length].includes(mentionIndex)) return;
		delete args[mentionIndex];
		commandName = args.shift()!;
		if (!commandName) commandName = "chat";
	} else {
		commandName = "chat";
	}
	return [commandName, args];
}

export async function responseInfo(_message: Message) { }

export async function checkStatus(environment: Environment) {
	let status: keyof typeof NoCooldown | "plan" = "user";

	const hasVote = voted(environment.user);

	if (hasVote) status = "voter";

	const prem = await premium(environment);
	if (prem) status = prem.type;

	return status;
}

export function errorCallback(bot: Bot, cmd: Command, err: NonNullable<unknown>) {
	bot.logger.error(`There was an error trying to execute the command ${cmd.body.name}`);
	bot.logger.error("A detailed walkthrough is provided below.");
	bot.logger.error(err);
}

export async function manageCooldown(bot: Bot, message: Message, environment: Environment, cmd: Command) {
	const status = await checkStatus(environment);

	if (status === "plan") return true;

	const hasCooldown = await checkCooldown(message.author.id, cmd, status);
	if (hasCooldown) {
		await bot.helpers.sendMessage(message.channelId, {
			embeds: hasCooldown,
			messageReference: {
				failIfNotExists: false,
				messageId: message.id,
			},
		});
		return;
	}

	return true;
}
