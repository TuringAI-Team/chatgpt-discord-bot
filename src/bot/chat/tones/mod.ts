import type { ConversationMessage } from "../../types/conversation.js";
import type { RestrictionName } from "../../utils/restriction.js";

import Helpful from "./helpful.js";
import Neutral from "./neutral.js";
import Precise from "./precise.js";
import Angry from "./angry.js";
import Drunk from "./drunk.js";
import Funny from "./funny.js";

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
	restrictions?: RestrictionName[];

	/** Messages for the tone */
	prompt?: ConversationMessage;
}

export const TONES: ChatTone[] = [
	Neutral, Helpful, Funny, Precise, Angry, Drunk
];