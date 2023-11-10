import { OpenChatModel } from "../index.js";

export const zephyr = {
	id: "zephyr",
	name: "Zephyr Beta",
	description: "Large Language Model based on Mistral by HuggingFace",
	emoji: { name: "h4", id: "1172422806147969095" },
	maxTokens: 4096,
	run: async (api, data) => {
		return await api.text.zephyr({
			...data,
		});
	},
} as OpenChatModel;
