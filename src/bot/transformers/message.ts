import { DiscordMessage, Message, transformUser } from "discordeno";

import { transformResponse, type MessageResponse } from "../utils/response.js";
import { createTransformer } from "../helpers/transformer.js";
import type { CustomMessage } from "../types/discordeno.js";

export default createTransformer<"message", Message, DiscordMessage>(
	"message",
	
	(bot, message, raw) => {
		Object.defineProperty(message, "reply", {
			value: function (response: Omit<MessageResponse, "reference">) {
				return bot.helpers.sendMessage(bot.transformers.snowflake(message.channelId), transformResponse({
					...response, reference: message as CustomMessage
				}));
			}
		});

		Object.defineProperty(message, "author", {
			value: transformUser(bot, raw.author),
			enumerable: true
		});

		delete message.activity;
		delete message.application;
		delete message.applicationId;
		delete message.components;
		delete message.stickerItems;
		delete message.reactions;
		delete message.nonce;
		delete message.interaction;

		return message;
	}
);