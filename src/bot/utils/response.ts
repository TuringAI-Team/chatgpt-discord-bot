import type { ActionRow, CreateMessage, EditMessage, Embed, InteractionCallbackData } from "discordeno";
import type { CustomMessage } from "../types/discordeno.js";

import { ApplicationCommandFlags } from "discordeno";

export interface MessageResponse {
    /** Content of the response */
    content?: string;

    /** Embeds of the response */
    embeds?: Embed | Embed[];

	/** Components of the message */
	components?: ActionRow[];

	/** Which file to upload */
	file?: {
		/** Name of the file */
		name: string;

		/** Base64-encoded data of the file */
		blob: string;
	};

    /** Whether the response should only be shown to the author */
    ephemeral?: boolean;

    /** Message to reply to */
    reference?: CustomMessage;
}

export enum EmbedColor {
	White = 0xffffff,
	Aqua = 0x1abc9c,
	Green = 0x57f287,
	Blue = 0x3498db,
	Yellow = 0xfee75c,
	Purple = 0x9b59b6,
	LuminousVividPink = 0xe91e63,
	Fuchsia = 0xeb459e,
	Gold = 0xf1c40f,
	Orange = 0xe67e22,
	Red = 0xed4245,
	Grey = 0x95a5a6,
	Navy = 0x34495e,
	DarkAqua = 0x11806a,
	DarkGreen = 0x1f8b4c,
	DarkBlue = 0x206694,
	DarkPurple = 0x71368a,
	DarkVividPink = 0xad1457,
	DarkGold = 0xc27c0e,
	DarkOrange = 0xa84300,
	DarkRed = 0x992d22,
	DarkGrey = 0x979c9f,
	DarkerGrey = 0x7f8c8d,
	LightGrey = 0xbcc0c0,
	DarkNavy = 0x2c3e50,
	Blurple = 0x5865f2,
	Greyple = 0x99aab5,
	DarkButNotBlack = 0x2c2f33,
	NotQuiteBlack = 0x23272a
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
		components: response.components,
		file: response.file,

		messageReference: response.reference ? {
			failIfNotExists: false,
			channelId: response.reference.channelId,
			guildId: response.reference.guildId,
			messageId: response.reference.id
		} : undefined
	} as T;
}