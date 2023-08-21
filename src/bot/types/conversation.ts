export interface Conversation {
	/** ID of the conversation */
	id: string;

	/** Interactions in the history */
	history: ConversationInteraction[];
}

export interface ConversationInteraction {
	/** The ID of the interaction */
	id: string;

	input: ConversationMessage;
	output: ConversationMessage;
}

export interface ConversationResult {
	/** The ID of the message */
	id: string;

	/** Whether the generation is done */
	done: boolean;

	/** The resulting message */
	message: ConversationMessage;
}

export interface ConversationMessage {
	/** Author of the message */
	role: "assistant" | "user" | "system";

	/** Content of the message */
	content: string;
}

export type ConversationUserMessage = ConversationMessage & {
	role: "user";
}