export interface Conversation {
	/** ID of the conversation */
	id: string;

	/** Messages in the history */
	history: ConversationMessage[];
}

export interface ConversationMessage {
	/** Author of the message */
	author: "bot" | "user";

	/** Content of the message */
	content: string;
}