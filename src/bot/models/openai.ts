import { DALLEModel, GPTModel } from "./index.js";

const GPT3_5 = {
	id: "gpt3.5",
	name: "ChatGPT",
	description: "The usual ChatGPT",
	emoji: { name: "chatgpt", id: "1097849346164281475" },
	maxTokens: 4096,
	run: (api, data) => {
		return api.text.gpt({
			...data,
			model: "gpt-3.5-turbo",
		});
	},
} satisfies GPTModel;

const GPT16K = {
	id: "gpt16k",
	name: "ChatGPT 16k",
	description: "The usual ChatGPT, but with a 16k context window!",
	emoji: { name: "chatgpt_16k", id: "1118928845244989500" },
	maxTokens: 4096,
	run: (api, data) => {
		return api.text.gpt({
			...data,
			model: "gpt-3.5-turbo",
		});
	},
} satisfies GPTModel;

const GPT4 = {
	id: "gpt4",
	name: "GPT 4",
	description: "The latest iteration of OpenAI's GPT models",
	emoji: { name: "gpt3", id: "1097849352657047562" },
	premium: true,
	maxTokens: 8192,
	run: (api, data) => {
		return api.text.gpt({
			...data,
			model: "gpt-3.5-turbo",
		});
	},
} satisfies GPTModel;

const DALLE2 = {
	id: "dalle2",
	name: "DALL-E 2",
	variableSizes: {
		0: {
			width: 256,
			height: 256,
		},
		1: {
			width: 512,
			height: 512,
		},
		2: {
			width: 1024,
			height: 1024,
		},
	},
	run: (api, data) => api.image.dall(data),
} satisfies DALLEModel<2>;

export { GPT3_5, GPT16K, GPT4, DALLE2 };
