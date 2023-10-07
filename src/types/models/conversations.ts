export interface ConversationMessage {
	/** Author of the message */
	role: "assistant" | "user" | "system";

	/** Content of the message */
	content: string;
}

export type ConversationUserMessage = ConversationMessage & {
	role: "user";
};
