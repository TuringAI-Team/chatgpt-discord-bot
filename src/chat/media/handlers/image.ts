import { Awaitable, Message } from "discord.js";

import { ChatAnalyzedImage, ChatBaseImage, ChatImageAttachment, ChatImageAttachmentExtractorData, ChatImageAttachmentExtractors, ChatInputImage } from "../types/image.js";
import { ChatMediaHandler, ChatMediaHandlerHasOptions, ChatMediaHandlerRunOptions } from "../handler.js";
import { ChatMediaType } from "../types/media.js";
import { Utils } from "../../../util/utils.js";
import { ChatClient } from "../../client.js";

export class ImageChatHandler extends ChatMediaHandler<ChatBaseImage, ChatInputImage> {
    constructor(client: ChatClient) {
        super(client, {
            type: ChatMediaType.Images, message: "Looking at the images"
        });
    }

    public async has({ message }: ChatMediaHandlerHasOptions): Promise<boolean> {
        const results = await this.findImageAttachments(message);
        return results.length > 0;
    }

    public async run(options: ChatMediaHandlerRunOptions): Promise<ChatInputImage[]> {
        const attachments: ChatImageAttachment[] = await this.findImageAttachments(options.message);
        const results: ChatInputImage[] = [];

        const base: ChatBaseImage[] = await Promise.all(attachments
            .map(async attachment => {
                const data = await Utils.fetchBuffer(attachment.url);
                return { ...attachment, data: data! };
            }));

        for (const image of base) {
            /* Show a notice to the Discord user. */
            await this.client.manager.progress.notice(options, {
                text: `Looking at **\`${image.name}\`**`
            });

            /* Run the model-specific image analyzer, and gather all results. */
            const result: ChatAnalyzedImage = await options.model.analyze({
                ...options, attachment: image
            });

            results.push({
                name: image.name, type: image.type, url: image.url, ...result
            });
        }

        return results;
    }

    /**
     * Get all usable Discord image attachments.
     * @returns Usable Discord Image attachments
     */
    public async findImageAttachments(message: Message): Promise<ChatImageAttachment[]> {
        const total: ChatImageAttachment[] = [];

        for (const extractor of ChatImageAttachmentExtractors) {
            const data: ChatImageAttachmentExtractorData = this.imageAttachmentData(message);

            const condition: boolean = extractor.condition(data);
            if (!condition) continue;

            total.push(...(await extractor.extract(data) ?? []).map(extracted => ({
                ...extracted, type: extractor.type
            })));
        }

        return total;
    }

    private imageAttachmentData(message: Message): ChatImageAttachmentExtractorData {
        return {
            bot: this.client.manager.bot, message
        };
    }

    public prompt(image: ChatInputImage): string {
        return `[${Utils.titleCase(image.type)} = ${image.name}: "${image.description}"${image.text ? `, detected text: "${image.text}"` : ""}]`;
    }

    public initialPrompt(): string {
        return `
From now on, you are a text and image-based AI. Users will be able to attach images to their message for you to understand using the format: '[<image type> #<index> = <file name>: "<image description>". [optional: "Detected text: "<corrected OCR text>"]]'.
You must be able to act like you can see and understand these attached images, act as if you can see, view and read them, referring to them as attached image/emoji/sticker/etc.
Prioritize detected text from the image, fix OCR errors, and use logic and common sense to understand the image. Don't ask the user about the description, treat it as an image attachment.
`;
    }
}