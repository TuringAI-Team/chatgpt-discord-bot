// import { bold } from "colorette";

import { EmbedColor, MessageResponse } from "../utils/response.js";
import { SUPPORT_INVITE } from "../../config.js";
import { DiscordBot } from "../mod.js";
import { publisher } from "./mod.js";

interface JSONError {
	name: string;
	message: string;
	stack: string | null;
}

interface HandleErrorOptions {
    error: Error | unknown;
    guild: bigint | undefined;
}

export async function handleError(bot: DiscordBot, { error, guild }: HandleErrorOptions): Promise<MessageResponse> {
	const data = errorToJSON(error as Error);
	// bot.logger.error(bold("An error occurred"), "->", data);

	await publisher.send("error", {
		error: data, guild: guild?.toString() ?? null
	});

	return {
		embeds: {
			title: "Uh-oh... 😬",
			description: "It seems like an error has occurred. *The developers have been notified.*",
			footer: { text: SUPPORT_INVITE }, timestamp: Date.now(),
			color: EmbedColor.Red
		},

		ephemeral: true
	};
}

function errorToJSON(error: Error): JSONError {
	return {
		name: error.name,
		message: error.message,
		stack: error.stack ?? null
	};
}