import { DALLEModel, GPTModel, ImageModel } from "./index.js";

const GPT3 = {
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

const GPT316K = {
	name: "ChatGPT",
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
	name: "GPT 4",
	description: "The latest iteration of OpenAI's GPT models",
	emoji: { name: "gpt3", id: "1097849352657047562" },
	maxTokens: 8192,
	run: (api, data) => {
		return api.text.gpt({
			...data,
			model: "gpt-3.5-turbo",
		});
	},
} satisfies GPTModel;

const DALLE2 = {
	name: "DALL-E 2",
	description: "DALL-E 2 by OpenAI",
	baseSize: {
		width: 256,
		height: 256
	},
	run: (api, data) => {
		return api.image.dall(data)
	}
} satisfies DALLEModel<0>;

export { GPT3, GPT316K, GPT4, DALLE2 };
