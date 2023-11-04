import { OpenChatModel } from "../index.js";

export default {
	id: "openchat",
	name: "OpenChat",
	description: "Large Language Model based on LLaMA by OpenChat",
	emoji: { name: "openchat", id: "1130816635402473563" },
	maxTokens: 4096,
	run: async (api, data) => {
		return await api.text.openchat({
			...data,
			model: "openchat_v3.2_mistral",
		});
	},
} as OpenChatModel;
