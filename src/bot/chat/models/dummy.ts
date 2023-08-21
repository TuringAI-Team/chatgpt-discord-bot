import { setTimeout } from "timers/promises";
import { createChatModel } from "../../helpers/chat.js";
import { RestrictionType } from "../../utils/restriction.js";

export default createChatModel({
	name: "Dummy", description: "Testing model",
	emoji: "⚠️", id: "dummy",

	restrictions: [ RestrictionType.Developer ],
	maxTokens: 8191,

	initialPrompt: [
		{
			author: "system",
			content: "You are ChatGPT, an AI language model created by OpenAI."
		}
	],

	handler: async ({ emitter }) => {
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