import { OpenChatModel } from "../index.js";

export default {
	id: "gemini",
	name: "Gemini",
	description: "Last Google Large Language Model",
	emoji: { name: "gemini", id: "1185280770877698048" },
	maxTokens: 4096,
	run: async (api, data) => {
		return await api.text.google({
			...data,
		});
	},
} as OpenChatModel;
