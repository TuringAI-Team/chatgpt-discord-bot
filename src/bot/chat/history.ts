import { get_encoding } from "@dqbd/tiktoken";
const encoder = get_encoding("cl100k_base");

import type { Conversation, ConversationMessage, ConversationUserMessage } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { ChatModel } from "./models/mod.js";
import type { ChatTone } from "./tones/mod.js";
import type { DiscordBot } from "../mod.js";

interface BuildHistoryOptions {
	bot: DiscordBot;
	conversation: Conversation;
	input: ConversationUserMessage;
	model: ChatModel;
	tone: ChatTone;
	env: DBEnvironment;
}

export interface HistoryData {
	/** Maximum amount of tokens to generate */
	maxTokens: number;

	/** Messages in the history */
	messages: ConversationMessage[];
}

const MAX_LENGTH = {
	Context: {
		free: 700,
		voter: 750,
		subscription: 950,
		plan: 1000
	},

	Generation: {
		free: 350,
		voter: 400,
		subscription: 650,
		plan: 1000
	}
};

export function buildHistory(_: BuildHistoryOptions): HistoryData {
	let messages: ConversationMessage[] = [];
	let tokens = 0;

	do {
		if (messages.length > 0) messages = [];
		
		/* Get the initial prompt. */
	} while (tokens > 0);

	return {
		maxTokens: 0, messages
	};
}

/* Count together all tokens contained in a list of conversation messages. */
function getChatMessageLength(...messages: ConversationMessage[]) {
	/* Total tokens used for the messages */
	let total: number = 0;

	for (const message of messages) {
		/* Map each property of the message to the number of tokens it contains. */
		const propertyTokenCounts = Object.values(message).map(value => {
			/* Count the number of tokens in the property value. */
			return getMessageTokens(value);
		});

		/* Sum the number of tokens in all properties and add 4 for metadata. */
		total += propertyTokenCounts.reduce((a, b) => a + b, 4);
	}

	return total + 2;
}

/** Count together all the tokens in a string. */
function getMessageTokens(content: string) {
	return encoder.encode(content).length;
}