import type { CustomMessage } from "../types/discordeno.js";
import type { DiscordBot } from "../index.js";

import type { ChatModelName, ChatModelResult } from "./models/index.js";
import type { DBEnvironment } from "../../db/types/index.js";
import type { MessageResponse } from "../utils/response.js";
import type { Conversation } from "./types/conversation.js";

export async function handleMessage(bot: DiscordBot, message: CustomMessage) {
	if (!mentions(bot, message)) return;

	const env = await bot.db.env(message.authorId, message.guildId);
	
	message.reply(format(bot, env, {
		content: "ok",
		done: false
	}));
}

/** Execute the chat request, on the specified model. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function execute(
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	bot: DiscordBot, env: DBEnvironment, conversation: Conversation, name: ChatModelName
) {

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