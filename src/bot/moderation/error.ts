import { DiscordBot } from "../index.js";
import { MessageResponse } from "../utils/response.js";

interface HandleErrorOptions {
    error: Error | unknown;
}

export function handleError(bot: DiscordBot, { error }: HandleErrorOptions): MessageResponse {
    bot.logger.error(error);

    return {
        embeds: {
            title: "Uh-oh... "
        }
    }
}