import type { DiscordUser, Interaction, Message } from "discordeno";
import type { MessageResponse } from "../utils/response.js";

export interface CustomInteraction extends Interaction {
	/** Defer the interaction, to be edited at a future point. */
	deferReply: () => Promise<void>;

	/** Defer an update, meaning that the interaction is silently acknowledged. */
	deferUpdate: () => Promise<void>;

	/** Send a reply to an interaction. */
	reply: (response: MessageResponse) => Promise<Message>;

	/** Edit the original reply to an interaction. */
	editReply: (response: MessageResponse) => Promise<Message>;

	/** Update the original reply to an interaction. */
	update: (response: MessageResponse) => Promise<Message>;

	/** Delete the original reply to the interaction. */
	deleteReply: () => void;
}

export interface CustomMessage extends Omit<Message, "stickerItems" | "application" | "applicationId" | "components" | "reactions" | "nonce" | "interaction"> {
	/** Author of the message */
	author: DiscordUser;

    /** Reply to a message. */
	reply: (response: Omit<MessageResponse, "reference"> | string) => Promise<Message>;
}

export interface DiscordComponentEmoji {
	/** Emoji ID */
	id?: bigint;

	/** Emoji name */
	name: string;

	/** Whether this emoji is animated */
	animated?: boolean;
}