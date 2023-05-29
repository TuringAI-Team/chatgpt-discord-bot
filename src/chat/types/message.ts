import { ChatOutputImage } from "./image.js";

export enum MessageType {
	Notice = "Notice",
	ChatNotice = "ChatNotice",
	Chat = "Chat"
}

export type MessageStopReason = "maxLength" | "stop"

export interface MessageDataTokenUsage {
	completion: number;
	prompt: number;
}

export interface MessageData {
	/* How many tokens were used for the prompt & completion */
	usage?: MessageDataTokenUsage;

	/* Why the message stopped generating */
	finishReason?: MessageStopReason;

	/* How long the message took to generate, in milliseconds */
	duration?: number;

	/* How much this message cost to generate, used for Alan */
	cost?: number;
}

export interface BaseMessage {
	/* Text to prioritize to display for the user */
	display?: string;

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

export type PartialChatNoticeMessage = Partial<Pick<ChatNoticeMessage, "raw" | "type" | "images">> & Pick<ChatNoticeMessage, "text" | "display" | "notice">

export type PartialResponseMessage = Partial<Pick<ResponseMessage, "raw" | "type" | "images">> & Pick<ResponseMessage, "text" | "display">