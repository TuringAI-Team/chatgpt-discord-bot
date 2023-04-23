import { Channel, Guild, TextChannel } from "discord.js";

import { Bot } from "../../bot/bot.js";
import { Config } from "../../config.js";

/**
 * Get the specified text channel.
 * 
 * @throws An error, if the channel could not be found
 * @returns The specified text channel
 */
export const messageChannel = async (bot: Bot, type: keyof Config["channels"]): Promise<TextChannel> => {
    const guild: Guild = await bot.client.guilds.fetch(bot.app.config.channels[type].guild);
    const channel: Channel | null = await guild.channels.fetch(bot.app.config.channels[type].channel);

    if (channel === null) throw new Error("Invalid message channel has been given");
    if (!channel.isTextBased()) throw new Error("Message channel is not a text channel");

    return channel as TextChannel;
}