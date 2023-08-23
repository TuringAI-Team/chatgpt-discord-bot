import EventEmitter from "events";

import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "OpenChat", description: "Advancing open-source LLMs with imperfect data", id: "openchat",
	emoji: { name: "openchat", id: 1130816635402473563n },

	maxTokens: 4096,

	cooldown: {
		user: 50 * 1000,
		voter: 45 * 1000,
		subscription: 12.5 * 1000
	},

	initialPrompt: [
		{
			role: "user", content: "Who are you?"
		},

		{
			role: "assistant", content: "I am OpenChat, an open-source language model based on supervised fine-tuning (SFT), trained on ChatGPT and GPT-4 conversations."
		}
	],

	handler: async ({ bot, emitter, history }) => {
		const event: EventEmitter = await bot.api.text.openchat({
			messages: history.messages,
			max_tokens: history.maxTokens
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