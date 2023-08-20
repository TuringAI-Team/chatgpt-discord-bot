import type { CustomMessage } from "../../types/discordeno.js";

import { createEvent } from "../../helpers/event.js";
import { handleMessage } from "../../chat/index.js";

export default createEvent("messageCreate", async (bot, message) => {
	try {
		await handleMessage(bot, message as CustomMessage);
	} catch (error) {
		bot.logger.error("Failed to handle message ->", error);
	}
});