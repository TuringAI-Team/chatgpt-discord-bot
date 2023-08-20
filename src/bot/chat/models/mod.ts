import EventEmitter from "events";

import type { Conversation, ConversationMessage } from "../types/conversation.js";
import type { DBEnvironment } from "../../../db/types/mod.js";
import type { DiscordBot } from "../../mod.js";

import ChatGPT from "./chatgpt.js";

export enum ChatModelName {
	ChatGPT = "chatgpt"
}

export class ChatEmitter {
	private readonly emitter: EventEmitter;

	constructor() {
		this.emitter = new EventEmitter();
	}

	public emit(data: ChatModelResult) {
		this.emitter.emit("data", data);
	}

	public on(listener: (data: ChatModelResult) => void) {
		this.emitter.on("data", listener);
	}

	/** Wait until the chat request has been completed. */
	public async wait(): Promise<ChatModelResult> {
		return new Promise(resolve => {
			this.on(data => {
				if (data.done) resolve(data);
			});
		});
	}
}

export interface ChatModel {
	/** Name of the chat model */
	name: ChatModelName;

	/** Handler for the chat model */
	handler: (options: ChatModelHandlerOptions) => Promise<void> | void;
}

interface ChatModelHandlerOptions {
	bot: DiscordBot;
	env: DBEnvironment;
	conversation: Conversation;
	input: ConversationMessage & { author: "user" };
	emitter: ChatEmitter;
}

export interface ChatModelResult {
	/** Result message */
	content: string;
	
	/** Whether the generation is done */
	done: boolean;
}

export const MODELS: ChatModel[] = [
	ChatGPT
];