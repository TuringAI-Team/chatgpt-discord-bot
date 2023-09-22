import EventEmitter from "node:events";
import { Api } from "../api.js";

interface Model {
	name: string;
	description: string;
}

export interface ChatModel extends Model {
	emoji: { name: string; id: string };
	maxTokens: 2048 | 4096 | 8192;
}

export interface GPTModel extends ChatModel {
	run: (
		bot: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
			plugins?: string[];
		},
	) => EventEmitter | NonNullable<unknown>;
}

export interface AnthropicModel extends ChatModel {
	run: (
		bot: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
			stream?: boolean;
		},
	) => EventEmitter | NonNullable<unknown>;
}

export interface OpenChatModel extends ChatModel {
	run: (
		bot: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
		},
	) => EventEmitter | NonNullable<unknown>;
}

export type ImageModel = Model;
