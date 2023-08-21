import type { CustomMessage } from "../../types/discordeno.js";

import { ResponseError } from "../../error/response.js";
import { createEvent } from "../../helpers/event.js";
import { handleMessage } from "../../chat/mod.js";

export default createEvent("messageCreate", async (bot, message) => {
	try {
		await handleMessage(bot, message as CustomMessage);
	} catch (error) {
		if (error instanceof ResponseError) {
			return void await (message as CustomMessage).reply(
				error.display()
			);
		}

		bot.logger.error("Failed to handle message ->", error);
	}
});