import EventEmitter from "events";

import type { ConversationMessage, ConversationResult, ConversationUserMessage } from "../../types/conversation.js";
import type { DiscordComponentEmoji } from "../../types/discordeno.js";
import type { RestrictionType } from "../../utils/restriction.js";
import type { DBEnvironment } from "../../../db/types/mod.js";
import type { HistoryData } from "../history.js";
import type { DiscordBot } from "../../mod.js";

import ChatGPT from "./chatgpt.js";
import Dummy from "./dummy.js";

export class ChatEmitter<T extends ConversationResult | ChatModelResult = ChatModelResult> {
	private readonly emitter: EventEmitter;

	constructor() {
		this.emitter = new EventEmitter();
	}

	public emit(data: T) {
		this.emitter.emit("data", data);
	}

	public on(listener: (data: T) => void) {
		this.emitter.on("data", listener);
	}

	/** Wait until the chat request has been completed. */
	public async wait(timeout: number = 120 * 1000): Promise<T> {
		return Promise.race<T>([
			new Promise(resolve => {
				this.on(data => {
					if (data.done) resolve(data);
				});
			}),

			// eslint-disable-next-line @typescript-eslint/no-unused-vars
			new Promise((_, reject) => {
				setTimeout(() => {
					reject(new Error("Timed out"));
				}, timeout);
			})
		]);
	}
}

export interface ChatModel {
	/** Name of the chat model */
	name: string;

	/** Identifier of the chat model */
	id: string;

	/** Description of the chat model */
	description: string;

	/** Emoji of the chat model */
	emoji: DiscordComponentEmoji | string;

	/** Which users this chat model is restricted to */
	restrictions?: RestrictionType[];

	/* Initial instructions to pass to the request */
	initialPrompt?: ConversationMessage;

	/** Limits of the model, in terms of tokens */
	maxTokens: number;

	/** Handler for the chat model */
	handler: (options: ChatModelHandlerOptions) => Promise<void> | void;
}

interface ChatModelHandlerOptions {
	bot: DiscordBot;
	env: DBEnvironment;
	history: HistoryData;
	input: ConversationUserMessage;
	emitter: ChatEmitter;
}

export interface ChatModelResult {
	/** Result message */
	content: string;
	
	/** Whether the generation is done */
	done: boolean;
}

export const MODELS: ChatModel[] = [
	ChatGPT, Dummy
];