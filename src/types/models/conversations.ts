export interface ConversationMessage {
	/** Author of the message */
	role: "assistant" | "user" | "system";

	/** Content of the message */
	content: string;
}

export type ConversationUserMessage = ConversationMessage & {
	role: "user";
};

export type ConversationHistory = {
	datasetId: string;
	messages: ConversationMessage[];
};
export type Conversation = {
	id: string;
	history: ConversationHistory;
	last_update: number;
	model: string;
};
