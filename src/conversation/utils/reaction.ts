import { Message, Routes } from "discord.js";

import { Bot } from "../../bot/bot.js";

export class Reaction {
    public static async add(bot: Bot, message: Message, emoji: string): Promise<void> {
        await bot.client.rest.put(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
    }
    
    public static async remove(bot: Bot, message: Message, emoji: string): Promise<void> {
        await bot.client.rest.delete(Routes.channelMessageOwnReaction(message.channelId, message.id, encodeURIComponent(emoji))).catch(() => {});
    }
}