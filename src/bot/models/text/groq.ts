import { OpenChatModel } from "../index.js";

export default {
	id: "mixtral-8x7b-32768",
	name: "Mixtral",
	description: "Large Language Model created by Mistral and inferenced by Groq.",
	emoji: { name: "mistral", id: "1213495168179642480" },
	maxTokens: 4096,
	run: async (api, data) => {
		return await api.text.groq({
			...data,
			model: "mixtral-8x7b-32768",
		});
	},
} as OpenChatModel;
