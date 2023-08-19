import { Message } from "discordeno";

import { transformResponse, type MessageResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";
import type { CustomMessage } from "../types/discordeno.js";

export default createTransformer("message", (bot, message: Message) => {
	Object.defineProperty(message, "reply", {
		value: function (response: Omit<MessageResponse, "reference">) {
			return bot.helpers.sendMessage(bot.transformers.snowflake(message.channelId), transformResponse({
				...response, reference: message as CustomMessage
			}));
		}
	});

	return message;
});