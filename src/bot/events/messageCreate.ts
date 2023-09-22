import { BigString, Bot, Message } from "@discordeno/bot";
import { commands } from "../index.js";

export const MentionRegex = (id: BigString) => new RegExp(`^<@!?${id}>\\s*$`);

export const messageCreate = async (message: Message, bot: Bot) => {
	if (!message.content?.length) return;
	if (message.author.bot || message.webhookId) return;

	const regex = MentionRegex(bot.id);

	if (message.content.match(regex)) {
		// message response for only mention
		// @chat-gpt
	}

	const args = message.content
		.trim()
		.split(/ +/)
		.filter((a) => !!a);

	const mentionIndex = args.findIndex((a) => !!a.match(regex)?.[0]);

	if (mentionIndex < 0) return;
	// 0 or max args for compatibility with arabian
	if (![0, args.length].includes(mentionIndex)) return;
	delete args[mentionIndex];

	const command = commands.get(args[0]);

	// biome-ignore lint/complexity/useSimplifiedLogicExpression: typescript cries
	if (!command || !command.message) return;

	await bot.helpers.triggerTypingIndicator(message.channelId);

	await command.message({ bot, message }).catch((err) => {
		bot.logger.error(`There was an error trying to execute the command ${command.body.name}`);
		bot.logger.error("A detailed walkthrough is provided below.");
		bot.logger.error(err);
	});
};
