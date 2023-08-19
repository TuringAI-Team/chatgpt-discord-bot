import { ApplicationCommandFlags, type CreateMessage, type EditMessage, type Embed, type InteractionCallbackData } from "discordeno";
import type { CustomMessage } from "../types/discordeno.js";

export interface MessageResponse {
    /** Content of the response */
    content?: string;

    /** Embeds of the response */
    embeds?: Embed | Embed[];

    /** Whether the response should only be shown to the author */
    ephemeral?: boolean;

    /** Message to reply to */
    reference?: CustomMessage;
}

export enum EmbedColor {
    Red = 0xed4245
}

export function transformResponse<T extends (CreateMessage | EditMessage | InteractionCallbackData) & {
    messageReference?: CreateMessage["messageReference"],
    ephemeral?: boolean
} = CreateMessage>(
	response: MessageResponse
): T {
	return {
		content: response.content,

		embeds: response.embeds ?
			Array.isArray(response.embeds) ? response.embeds
				: [ response.embeds ]
			: undefined,

		flags: response.ephemeral ? ApplicationCommandFlags.Ephemeral : undefined,

		messageReference: response.reference ? {
			failIfNotExists: false,
			channelId: response.reference.channelId,
			guildId: response.reference.guildId,
			messageId: response.reference.id
		} : undefined
	} as T;
}