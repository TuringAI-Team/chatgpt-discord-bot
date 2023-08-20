/* eslint-disable @typescript-eslint/no-unused-vars */
import type { CustomMessage } from "../types/discordeno.js";
import type { DiscordBot } from "../index.js";

export function handleMessage(bot: DiscordBot, message: CustomMessage) {
	
}

function mentions(bot: DiscordBot, message: CustomMessage) {
	return message.mentionedUserIds.includes(bot.id);
}