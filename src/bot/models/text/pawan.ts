import { PawanChatModel } from "../index.js";

export const Zephyr = {
	id: "zephyr",
	name: "Zephyr Beta",
	description: "Large Language Model based on Mistral by HuggingFace",
	emoji: { name: "h4", id: "1172422806147969095" },
	maxTokens: 4096,
	run: async (api, data) => {
		return await api.text.pawan({
			...data,
			model: "zephyr-7b-beta",
		});
	},
} as PawanChatModel;
