import { Attachment, Message, Sticker, StickerFormatType } from "discord.js";
import { Utils } from "../../util/utils.js";

export type ChatImageType = "image" | "sticker" | "emoji"

export const ALLOWED_FILE_EXTENSIONS: string[] = [ "webp", "png", "jpeg", "jpg", "gif" ]
const EMOJI_REGEX = /<(a?)?:[\w-]+:(\d{18,19})?>/gu

export class ImageBuffer {
    private data: Buffer;

    constructor(data: Buffer) {
        this.data = data;
    }

    public static from(buffer: ArrayBuffer): ImageBuffer {
        return new ImageBuffer(Buffer.from(buffer));
    }

    /**
     * Create a new image buffer from the specified Base64 string.
     * @param data Base64 string to convert into a buffer
     * @returns 
     */
    public static load(data: string): ImageBuffer {
        return new ImageBuffer( Buffer.from(data, "base64"));
    }

    /**
     * Convert the image buffer into a Base64 string.
     * @returns Base64-encoded image data
     */
    public toString(): string {
        return this.data.toString("base64");
    }

    public get buffer(): Buffer {
        return this.data;
    }
}

export interface ChatAttachment {
    /* Name of the attachment */
    name: string;

    /* Type of the attachment */
    type: ChatImageType;

    /* URL to the attachment */
    url: string;
}

export type ChatExtractedAttachment = Pick<ChatAttachment, "name" | "url">

export interface ChatAttachmentExtractor {
    /* Type of the attachment */
    type: ChatImageType;

    /* Whether the message contains this type of attachment */
    condition: (message: Message) => boolean;

    /* Whether the message contains this type of attachment */
    extract: (message: Message) => ChatExtractedAttachment[] | null;
}

export const ChatAttachmentExtractors: ChatAttachmentExtractor[] = [
    {
        type: "image",

        condition: message => message.attachments.filter(
            a => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(a.name))
        ).size > 0,

        extract: message => {
            const attachments: Attachment[] = Array.from(message.attachments.filter(
                a => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(a.name))
            ).values());

            return attachments.map(a => ({
                name: a.name,
                url: a.url
            }));
        }
    },

    {
        type: "sticker",
        condition: message => message.stickers.size > 0,

        extract: message => {
            const stickers: Sticker[] = Array.from(message.stickers.values())
                .filter(s => s.format !== StickerFormatType.Lottie);

            return stickers.map(s => ({
                name: s.name, url: s.url
            }))
        }
    },

    {
        type: "emoji",
        condition: message => message.content.match(EMOJI_REGEX) !== null,

        extract: message => {
            const match = message.content.match(EMOJI_REGEX);
            if (match === null) return null;
            
            let emote = match[0];
            let name = emote.split(":")[1];
            let id = emote.split(":")[2].slice(0,-1);

            const type = message.content.includes("<a:") ? "gif" : "png";

            return [ {
                url: `https://cdn.discordapp.com/emojis/${id}.${type}?v=1`,
                name: name
            } ];
        }
    }
]

export interface ChatBaseImage {
    /* Name of the image */
    name: string;

    /* Type of image */
    type: ChatImageType;

    /* Buffer data of the image */
    data: ImageBuffer;

    /* URL to the image */
    url: string;
}

export type ChatInputImage = Pick<ChatBaseImage, "name" | "type"> & {
    /* Readable text about this image, given to the model */
    description: string;

    /* Text recognized in the image, `null` if none was detected */
    text: string | null;
}

export type ChatAnalyzedImage = Pick<ChatInputImage, "description" | "text">

export interface ChatOutputImage {
    /* Final rendered image */
    data: ImageBuffer;

    /* Optional; prompt used to generate the image */
    prompt?: string;

    /* Optional; an additional note in the footer of the embed */
    notice?: string;

    /* Optional; how long the image took to render/generate */
    duration?: number;
}