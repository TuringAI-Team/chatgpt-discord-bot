import { setTimeout } from "timers/promises";

import { RestrictionType } from "../../utils/restriction.js";
import { createChatModel } from "../../helpers/chat.js";

export default createChatModel({
	name: "Dummy", description: "Testing model",
	emoji: "⚠️", id: "dummy",

	initialPrompt: {
		author: "system",
		content: "You are ChatGPT, an AI language model created by OpenAI."
	},

	restrictions: [ RestrictionType.Developer ],
	maxTokens: 8191,

	handler: async ({ emitter, history }) => {
		console.log(history);

		emitter.emit({
			content: "not done", done: false
		});

		await setTimeout(3000);

		emitter.emit({
			content: "still not done", done: false
		});

		await setTimeout(3000);

		emitter.emit({
			content: "done", done: true
		});
	}
});