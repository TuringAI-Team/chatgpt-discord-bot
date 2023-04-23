import { Message, Routes } from "discord.js";

import { Bot } from "../../bot/bot.js";

/**
 * Remove the specified reaction from the message.
 * Don't do anything if the reaction doesn't exist on the message.
 * 
 * @param emoji Emoji reaction to remove
 * @param message Message to remove reaction from
 * 
 * @returns Whether a reaction was removed
 */
export const removeReaction = async (bot: Bot, message: Message, emoji: string): Promise<void> => {
    await bot.client.rest.delete(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
}

export const reactToMessage = async (bot: Bot, message: Message, emoji: string): Promise<void> => {
    await bot.client.rest.put(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
}