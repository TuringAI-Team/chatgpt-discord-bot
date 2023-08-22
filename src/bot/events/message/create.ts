import type { CustomMessage } from "../../types/discordeno.js";

import { handleMessage, runningGenerations } from "../../chat/mod.js";
import { ResponseError } from "../../error/response.js";
import { createEvent } from "../../helpers/event.js";

export default createEvent("messageCreate", async (bot, message) => {
	try {
		await handleMessage(bot, message as CustomMessage);
	} catch (error) {
		if (error instanceof ResponseError) {
			return void await (message as CustomMessage).reply(
				error.display()
			);
		}

		runningGenerations.delete(message.authorId);
		bot.logger.error("Failed to handle message ->", error);
	}
});