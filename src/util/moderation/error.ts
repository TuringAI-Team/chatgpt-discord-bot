import { DiscordAPIError, EmbedBuilder, Message, MessageCreateOptions } from "discord.js";
import chalk from "chalk";

import { Response } from "../../command/response.js";
import { messageChannel } from "./channel.js";
import { Bot } from "../../bot/bot.js";
import { Utils } from "../utils.js";

interface ErrorHandlingOptions {
    message?: Message;
    error: Error;

    title?: string;
    reply?: boolean;
}

/**
 * Reply to the invocation message with the occurred error & also
 * add a reaction to the message.
 * 
 * @param message Message to reply & react to 
 * @param error Error that occurred
 * @param title Custom title for the error message
 * @param reply Whether to reply to the invocation message
 */
export const handleError = async (bot: Bot, { message, error, title, reply }: ErrorHandlingOptions) => {
    if (error instanceof DiscordAPIError && error.toString().includes("Missing Permissions")) return;

    /* Log the errror to the console. */
    //bot.logger.error("An error occurred while processing a request ->", error);

    /* Send the error message as a reply. */
    if (!!reply && message) {
        const embed: EmbedBuilder = new EmbedBuilder()
            .setTitle(`${title ?? "An error occurred"} ⚠️`)
            .setDescription("*The developers have been notified.*")
            .setColor("Red");

        await Promise.all([
            message.reply({ embeds: [ embed ] }),
            message.react("⚠️")
        ]).catch(() => {});
    }

    /* Send the error message to the moderation channel. */
    await sendErrorMessage(bot, { message, error, title });
}

/**
 * Send the "error message" notice in the dedicated channel.
 * @param error Error to log to the channel
 */
const sendErrorMessage = async (bot: Bot, { error, title }: Omit<ErrorHandlingOptions, "reply">): Promise<void> => {
    /* Get the moderation channel. */
    const channel = await messageChannel(bot, "error");

    const reply = new Response()
        .addEmbed(builder => builder
            .setTitle("An error occurred ⚠️")
            .setDescription(`${title !== undefined ? `*${title}*\n\n` : ""}\`\`\`\n${Utils.truncate(error.toString(), 300)}\n\n${error.stack!.split("\n").slice(1).join("\n")}\n\`\`\``)
            .setColor("Red")
        );

    /* Send the error message to the channel. */
    await channel.send(reply.get() as MessageCreateOptions);
}