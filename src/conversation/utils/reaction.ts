import { Message, Routes } from "discord.js";

import { Bot } from "../../bot/bot.js";

export const addReaction = async (bot: Bot, message: Message, emoji: string): Promise<void> => {
    await bot.client.rest.put(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
}

export const removeReaction = async (bot: Bot, message: Message, emoji: string): Promise<void> => {
    await bot.client.rest.delete(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
}

