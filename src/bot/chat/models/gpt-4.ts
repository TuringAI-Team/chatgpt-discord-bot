import EventEmitter from "events";

import { RestrictionName } from "../../utils/restriction.js";
import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "GPT-4", description: "OpenAI's newest GPT-4 model", id: "gpt-4",
	emoji: { name: "✨" },

	restrictions: [ RestrictionName.Premium ],
	maxTokens: 8191,

	cooldown: {
		subscription: 30 * 1000,
	},

	initialPrompt: {
		role: "system",
		content: "You are GPT-4, a new GPT model by OpenAI released on the 14th March 2023, an AI language model created by OpenAI."
	},

	handler: async ({ bot, emitter, history }) => {
		const event: EventEmitter = await bot.api.text.gpt({
			messages: history.messages,
			max_tokens: history.maxTokens,
			model: "gpt-4"
		}) as EventEmitter;

		event.on("data", data => {
			emitter.emit({
				content: data.result,
				finishReason: data.finishReason,
				cost: data.cost,
				done: data.done
			});
		});
	}
});