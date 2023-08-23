import type { Conversation } from "../types/conversation.js";

import { createCommand } from "../helpers/command.js";
import { ResponseError } from "../error/response.js";
import { resetConversation, runningGenerations } from "../chat/mod.js";
import { EmbedColor } from "../utils/response.js";

export default createCommand({
	name: "reset",
	description: "Reset your conversation with the bot",

	handler: async ({ bot, env, interaction }) => {
		const conversation = await bot.db.fetch<Conversation>("conversations", interaction.user.id);

		if (conversation.history.length === 0) throw new ResponseError({
			message: "You do not have an active conversation with the bot", emoji: "😔"
		});

		if (runningGenerations.has(BigInt(conversation.id))) throw new ResponseError({
			message: "Wait for the current request in your conversation to finish", emoji: "😔"
		});

		await resetConversation(bot, env);

		return {
			embeds: {
				description: "Your conversation has been reset 😊",
				color: EmbedColor.Green
			},

			ephemeral: true
		};
	}
});