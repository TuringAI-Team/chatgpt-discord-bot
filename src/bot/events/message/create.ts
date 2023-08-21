import type { CustomMessage } from "../../types/discordeno.js";

import { ResponseError } from "../../types/error.js";
import { createEvent } from "../../helpers/event.js";
import { handleMessage } from "../../chat/mod.js";

export default createEvent("messageCreate", async (bot, message) => {
	try {
		await handleMessage(bot, message as CustomMessage);
	} catch (error) {
		if (error instanceof ResponseError) {
			return void await (message as CustomMessage).reply({
				embeds: {
					description: `${error.options.message} ${error.options.emoji}`,
					color: error.options.color
				}
			});
		}

		bot.logger.error("Failed to handle message ->", error);
	}
});