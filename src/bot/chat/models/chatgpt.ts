import EventEmitter from "events";

import { createChatModel } from "../../helpers/chat.js";
import { ChatModelName } from "./mod.js";

export default createChatModel({
	name: ChatModelName.ChatGPT,

	handler: async ({ bot, emitter }) => {
		const event: EventEmitter = await bot.api.text.gpt({
			messages: [
				{
					author: "assistant",
					content: "hi"
				}
			],

			model: "gpt-3.5-turbo"
		}) as EventEmitter;

		event.on("data", data => {
			emitter.emit({
				content: data.result,
				done: data.done
			});
		});
	}
});