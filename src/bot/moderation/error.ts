import { EmbedColor, MessageResponse } from "../utils/response.js";
import { SUPPORT_INVITE } from "../../config.js";
import { DiscordBot } from "../index.js";

interface HandleErrorOptions {
    error: Error | unknown;
    guild: bigint | undefined;
}

export async function handleError(bot: DiscordBot, { error }: HandleErrorOptions): Promise<MessageResponse> {
	bot.logger.error(error);

	return {
		embeds: {
			title: "Uh-oh... 😬",
			description: "It seems like an error has occured. *The developers have been notified.*",
			footer: { text: SUPPORT_INVITE },
			color: EmbedColor.Red
		},

		ephemeral: true
	};
}