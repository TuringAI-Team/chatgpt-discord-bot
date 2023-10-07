import { ConversationMessage } from "../../types/models/conversations.js";
import neutral from "./neutral.js";
import precise from "./precise.js";

export interface ChatTone {
	/** Name of the chat tone */
	name: string;

	/** Identifier of the chat tone */
	id: string;

	/** Description of the chat tone */
	description: string;

	/** Emoji of the chat tone */
	emoji: string;

	/** Which users this chat tone is restricted to */

	/** Messages for the tone */
	prompt?: ConversationMessage | ConversationMessage[];
}

export const TONES: ChatTone[] = [neutral, precise];
