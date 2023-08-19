import type { Interaction, Message } from "discordeno";
import type { MessageResponse } from '../utils/response.js';

export interface CustomInteraction extends Interaction {
	/** Defer the interaction, to be edited at a future point. */
	defer: () => Promise<void>;

	/** Send a reply to an interaction. */
	reply: (response: MessageResponse) => Promise<Message>;

	/** Edit a deferred reply of an interaction. */
	editReply: (response: MessageResponse) => Promise<Message>;
}

export interface CustomMessage extends Message {
    /** Reply to a message. */
	reply: (response: Omit<MessageResponse, "reference"> | string) => Promise<Message>;
}