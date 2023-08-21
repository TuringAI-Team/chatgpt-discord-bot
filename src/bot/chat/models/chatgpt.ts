import EventEmitter from "events";

import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "ChatGPT", description: "The usual ChatGPT", id: "chatgpt",
	emoji: { name: "chatgpt", id: 1097849346164281475n },

	maxTokens: 8191,

	initialPrompt: [
		{
			author: "system",
			content: "You are ChatGPT, an AI language model created by OpenAI."
		}
	],

	handler: async ({ bot, emitter, history }) => {
		const event: EventEmitter = await bot.api.text.gpt({
			messages: history.messages, max_tokens: history.maxTokens,
			model: "gpt-3.5-turbo"
		}) as EventEmitter;

		event.on("data", data => {
			console.log(data);

			emitter.emit({
				content: data.result,
				done: data.done
			});
		});
	}
});