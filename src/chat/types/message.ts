import { ChatOutputImage } from "./image.js";
import { ChatButton } from "./button.js";
import { ChatEmbed } from "./embed.js";

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

export interface BaseMessage<Type extends MessageType = MessageType> {
	/* Type of the message */
	type: Type;

	/* Raw output message; or the message to display if `display` is not set */
	text: string;

	/* Text to prioritize to display for the user */
	display?: string;
}

export type ResponseMessage<Type extends MessageType = MessageType> = BaseMessage<Type> & {
	/* Information about token usage & why the message stopped generating, etc. */
	raw?: MessageData;

	/* Generated images, if applicable */
	images?: ChatOutputImage[];

	/* Additional buttons, if applicable */
	buttons?: ChatButton[];

	/* Additional embeds for the message, if applicable */
	embeds?: ChatEmbed[];
}

export type ResponseChatNoticeMessage = ResponseMessage<MessageType.ChatNotice> & {
	notice: string;
}

export type PartialChatNoticeMessage = PartialResponseMessage<ResponseChatNoticeMessage>

export type ResponseNoticeMessage = ResponseMessage<MessageType.Notice>

export type PartialResponseMessage<T extends ResponseMessage = ResponseMessage> = Partial<Pick<T, "raw" | "type" | "images" | "buttons" | "embeds">> & Pick<T, "text" | "display">
