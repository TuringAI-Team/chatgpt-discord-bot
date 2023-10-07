import { AnthropicModel } from "./index.js";

const Claude_instant = {
	id: "claude-instant",
	name: "Claude",
	description: "AI model developed by Anthropic v1",
	emoji: { name: "anthropic", id: "1097849339432423454" },
	maxTokens: 8192,
	run: (api, data) => {
		return api.text.anthropic({
			...data,
			model: "claude-instant-1.2",
		});
	},
} satisfies AnthropicModel;

const Claude = {
	id: "claude",
	name: "Claude 2",
	description: "AI model developed by Anthropic v2",
	emoji: { name: "anthropic", id: "1097849339432423454" },
	maxTokens: 8192,
	run: (api, data) => {
		return api.text.anthropic({
			...data,
			model: "claude-2",
		});
	},
} satisfies AnthropicModel;

export { Claude, Claude_instant };
