import { get_encoding } from "@dqbd/tiktoken";
const encoder = get_encoding("cl100k_base");

import type { Conversation, ConversationMessage, ConversationUserMessage } from "../types/conversation.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { ChatModel } from "./models/mod.js";
import type { ChatTone } from "./tones/mod.js";
import type { DiscordBot } from "../mod.js";

import { ChatError, ChatErrorType } from "../error/chat.js";

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

	/** Amount of tokens used for the history */
	usedTokens: number;

	/** Messages in the history */
	messages: ConversationMessage[];
}

const MAX_LENGTH = {
	Context: {
		user: 700,
		voter: 750,
		subscription: 950,
		plan: 1000
	},

	Generation: {
		user: 350,
		voter: 400,
		subscription: 650,
		plan: 1000
	}
};

export function buildHistory({ bot, env, model, tone, conversation, input }: BuildHistoryOptions): HistoryData {
	let messages: ConversationMessage[] = [];
	let tokens = 0;

	const type = bot.db.type(env);
	
	/** TODO: Limits for pay-as-you-go members */
	let maxGenerationLength = Math.min(MAX_LENGTH.Generation[type], model.maxTokens);
	const maxContextLength = Math.min(MAX_LENGTH.Context[type], model.maxTokens);

	if (getChatMessageLength(input) > maxContextLength) throw new ChatError(
		ChatErrorType.Length
	);

	do {
		if (messages.length > 0) messages = [];

		/* Add the model's and tone's initial prompts to the history. */
		if (model.initialPrompt) messages.push(model.initialPrompt);
		if (tone.prompt) messages.push(tone.prompt);

		/** Add the conversation's history. */
		for (const entry of conversation.history) {
			messages.push(
				{ role: "user", content: entry.input.content },
				{ role: "assistant", content: entry.output.content }
			);
		}

		/* Add the user's request. */
		messages.push(input);

		/* Tokens used for the initial prompt */
		tokens = getChatMessageLength(...messages);

		if (maxContextLength - tokens <= 0) conversation.history.shift();
		else break;
		
		/* Get the initial prompt. */
	} while (maxContextLength - tokens <= 0);

	maxGenerationLength = Math.min(
		model.maxTokens - tokens, maxGenerationLength
	);

	return {
		maxTokens: maxGenerationLength, usedTokens: tokens, messages
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