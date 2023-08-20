import type { CustomMessage } from "../../types/discordeno.js";

import { createEvent } from "../../helpers/event.js";
import { handleMessage } from "../../chat/index.js";

export default createEvent("messageCreate", (bot, message) => {
	handleMessage(bot, message as CustomMessage);
});