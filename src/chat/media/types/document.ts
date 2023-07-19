import { Attachment, Message } from "discord.js";
import { Utils } from "../../../util/utils.js";

/* Allowed extensions for text documents */
const ALLOWED_DOCUMENT_EXTENSIONS: string[] = [ "txt", "rtf", "c", "js", "py", "md", "html", "css" ]

/* HasteBin link RegExp */
export const HASTEBIN_LINK_REGEXP = /https:\/\/hastebin\.de\/([a-z0-9]+)/ig

export type ChatDocument = {
    /* Name of attached document */
    name: string;

    /* Actual content of the attached document */
    content: string;
}

export interface ChatDocumentExtractor {
    /* Whether the message contains this type of document */
    condition: (message: Message) => boolean;

    /* Callback, to extract & fetch this type of document */
    extract: (message: Message) => Promise<ChatDocument[] | null> | null;
}

export const ChatDocumentExtractors: ChatDocumentExtractor[] = [
    {
        condition: message => message.attachments.some(a => ALLOWED_DOCUMENT_EXTENSIONS.includes(Utils.fileExtension(a.name))),

        extract: async message => {
            const attachments: Attachment[] = Array.from(message.attachments.filter(
                a => ALLOWED_DOCUMENT_EXTENSIONS.includes(Utils.fileExtension(a.name))
            ).values());

            return await Promise.all(attachments.map(async a => ({
                name: a.name,
                content: await (await fetch(a.url)).text()
            })));
        }
    },

    {
        condition: message => message.content.match(HASTEBIN_LINK_REGEXP) !== null,

        extract: async message => {
            const matches: string[] = [];
            let match: RegExpExecArray | null = null;

            /* Gather all HasteBin document IDs from the message. */
            while (match = HASTEBIN_LINK_REGEXP.exec(message.content)) {
                matches.push(match[1]);
            }

            return await Promise.all(matches.map(async id => ({
                name: id,
                content: (await (await fetch(`https://hastebin.de/documents/${id}`)).json()).data
            })));
        }
    }
];