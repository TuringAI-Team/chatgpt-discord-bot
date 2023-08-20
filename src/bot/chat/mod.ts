import type { CustomMessage } from "../types/discordeno.js";
import type { DiscordBot } from "../mod.js";

import type { ChatModel, ChatModelResult } from "./models/mod.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { MessageResponse } from "../utils/response.js";
import type { Conversation } from "./types/conversation.js";

export async function handleMessage(bot: DiscordBot, message: CustomMessage) {
	if (!mentions(bot, message)) return;

	const env = await bot.db.env(message.authorId, message.guildId);
	// const conversation = await bot.db.fetch("conversations", message.authorId);
	
	message.reply(format(bot, env, {
		content: "ok",
		done: false
	}));
}

/** Execute the chat request, on the specified model. */
function execute(
	bot: DiscordBot, env: DBEnvironment, conversation: Conversation, model: ChatModel
) {
	/* TODO: Implement */
}

/** Format the chat model's response to be displayed on Discord. */
function format(
	bot: DiscordBot, env: DBEnvironment, result: ChatModelResult
): MessageResponse {
	return {
		content: `${result.content}${!result.done ? " **...**" : ""}`
	};
}

function mentions(bot: DiscordBot, message: CustomMessage) {
	return message.mentionedUserIds.includes(bot.id);
}