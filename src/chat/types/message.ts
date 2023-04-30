import { ChatOutputImage } from "./image.js";

export enum MessageType {
	Notice = "Notice",
	ChatNotice = "ChatNotice",
	Chat = "Chat",
	Suggestion = "Suggestion"
}

export type MessageStopReason = "maxLength" | "stop"

export interface MessageDataUsage {
	completion: number;
	prompt: number;
}

export interface MessageData {
	/* How many tokens were used for the prompt & completion */
	usage: MessageDataUsage | null;

	/* Why the message stopped generating */
	finishReason: MessageStopReason | null;
}

export interface BaseMessage {
	/* Text to prioritize to display for the user */
	displayText?: string;

	/* Raw output message; or the message to display if `displayText` is not set */
	text: string;

	/* Type of the message */
	type: MessageType;
}

export type ResponseMessage = BaseMessage & {
	/* Information about token usage & why the message stopped generating, etc. */
	raw: MessageData | null;

	/* Identifier of the message */
	id: string;

	/* Generated images, if applicable */
	images?: ChatOutputImage[];
}

export type ChatNoticeMessage = ResponseMessage & {
	type: MessageType.ChatNotice;
	notice: string;
}

export type PartialResponseMessage = Partial<Pick<ResponseMessage, "raw" | "type" | "images">> & Pick<ResponseMessage, "text" | "displayText">;