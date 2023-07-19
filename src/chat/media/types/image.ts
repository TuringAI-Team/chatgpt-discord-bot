import { Attachment, Embed, Message, Sticker, StickerFormatType } from "discord.js";

import { ImageBuffer } from "../../../util/image.js";
import { Utils } from "../../../util/utils.js";
import { Bot } from "../../../bot/bot.js";

export type ChatImageType = "image" | "sticker" | "emoji" | "Discord attachment link" | "Discord embed image" | "Tenor GIF"

export const ALLOWED_FILE_EXTENSIONS: string[] = [ "webp", "png", "jpeg", "jpg" ]

const DISCORD_CDN_REGEX = /https:\/\/(media|cdn)\.discordapp\.(com|net)\/attachments\/\d+\/\d+\/\S+\.(png|jpe?g|webp)/ig
const EMOJI_REGEX = /<(a?)?:[\w-]+:(\d{18,19})?>/gu

export interface ChatImageAttachment {
    /* Name of the attachment */
    name: string;

    /* Type of the attachment */
    type: ChatImageType;

    /* URL to the attachment */
    url: string;
}

export type ChatExtractedImageAttachment = Pick<ChatImageAttachment, "name" | "url">

export interface ChatImageAttachmentExtractorData {
    message: Message;
    bot: Bot;
}

export interface ChatImageAttachmentExtractor {
    /* Type of the attachment */
    type: ChatImageType;

    /* Whether the message contains this type of attachment */
    condition: (data: ChatImageAttachmentExtractorData) => boolean;

    /* Callback, to extract the attachments from the message */
    extract: (data: ChatImageAttachmentExtractorData) => Promise<ChatExtractedImageAttachment[] | null>;
}

export const ChatImageAttachmentExtractors: ChatImageAttachmentExtractor[] = [
    {
        type: "image",

        condition: ({ message }) => message.attachments.filter(
            a => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(a.name))
        ).size > 0,

        extract: async ({ message }) => {
            const attachments: Attachment[] = Array.from(message.attachments.filter(
                a => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(a.name).toLowerCase())
            ).values());

            console.log(attachments)

            return attachments.map(a => ({
                name: a.name,
                url: a.url
            }));
        }
    },

    {
        type: "sticker",
        condition: ({ message }) => message.stickers.size > 0,

        extract: async ({ message }) => {
            const stickers: Sticker[] = Array.from(message.stickers.values())
                .filter(s => s.format !== StickerFormatType.Lottie);

            return stickers.map(s => ({
                name: s.name, url: s.url
            }))
        }
    },

    {
        type: "emoji",
        condition: ({ message }) => message.content.match(EMOJI_REGEX) !== null,

        extract: async ({ message }) => {
            const match = message.content.match(EMOJI_REGEX);
            if (match === null) return null;
            
            let emote = match[0]; 
            let name = emote.split(":")[1];
            let id = emote.split(":")[2].slice(0, -1);

            const type = message.content.includes("<a:") ? "gif" : "png";

            return [ {
                url: `https://cdn.discordapp.com/emojis/${id}.${type}?v=1`,
                name: name
            } ];
        }
    },

    {
        type: "Discord attachment link",
        condition: ({ message }) => message.content.match(DISCORD_CDN_REGEX) !== null,

        extract: async ({ message }) => {
            const matches = message.content.match(DISCORD_CDN_REGEX);
            if (matches === null || matches.length === 0) return null;

            return matches.map(url => ({
                name: url.split("/").reverse()[0], url
            }));
        }
    },

    {
        type: "Discord embed image",
        condition: ({ message }) => message.embeds.length > 0 && message.embeds.some(e => e.image !== null) && message.embeds.some(e => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(e.image!.url))),

        extract: async ({ message }) => {
            const embeds: Embed[] = message.embeds.filter(
                e => ALLOWED_FILE_EXTENSIONS.includes(Utils.fileExtension(e.image!.url).toLowerCase())
            );

            return embeds.map(e => ({
                name: Utils.fileName(e.image!.url),
                url: e.image!.url
            }));
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

export type ChatInputImage = Pick<ChatBaseImage, "name" | "type" | "url"> & {
    /* Readable text about this image, given to the model */
    description: string;

    /* Text recognized in the image, `null` if none was detected */
    text: string | null;

    /* How long it took to analyze the image */
    duration: number | null;

    /* How much it cost to analyze this image */
    cost: number | null;
}

export type ChatAnalyzedImage = Pick<ChatInputImage, "description" | "text" | "cost" | "duration">

export interface ChatOutputImage {
    /* Final rendered image */
    data: ImageBuffer;

    /* The URL, where this image is stored (temporarily) */
    url?: string;

    /* Optional; prompt used to generate the image */
    prompt?: string;

    /* Optional; an additional note in the footer of the embed */
    notice?: string;

    /* Optional; how long the image took to render/generate */
    duration?: number;
}