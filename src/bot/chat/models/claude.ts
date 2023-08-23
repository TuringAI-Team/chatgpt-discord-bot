import EventEmitter from "events";

import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "Claude", description: "Next-generation AI assistant by Anthropic", id: "claude",
	emoji: { name: "anthropic", id: 1097849339432423454n },

	maxTokens: 100000,

	cooldown: {
		user: 75 * 1000,
		voter: 70 * 1000,
		subscription: 20 * 1000
	},

	initialPrompt: [
		{
			role: "user", content: "Who are you?"
		},

		{
			role: "assistant", content: "I am Claude, an AI chatbot created by Anthropic."
		}
	],

	handler: async ({ bot, emitter, history }) => {
		const event: EventEmitter = await bot.api.text.anthropic({
			messages: history.messages,
			max_tokens: history.maxTokens,
			model: "claude-instant-1-100k"
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