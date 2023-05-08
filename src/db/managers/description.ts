import { ChatImageAttachment, ImageBuffer } from "../../chat/types/image.js";
import { ImageOCRResult, detectText } from "../../util/ocr.js";
import { DescribeAttachment } from "../../util/describe.js";
import { ChatBaseImage } from "../../chat/types/image.js";
import { DatabaseManager } from "../manager.js";
import { Utils } from "../../util/utils.js";

export interface ImageDescriptionResult {
    /* BLIP description of the image */
    description: string;

    /* Detected text in this image, if enabled & detected */
    ocr: string | null;
}

export interface ImageDescription {
    /* ID (URL) of the described image */
    id: string;

    /* Base64-ified data of the image */
    image: string;

    /* How long it took to describe the image */
    duration: number;

    /* Description of the image */
    result: ImageDescriptionResult;
}

export type ImageDescriptionInput = ChatImageAttachment | ChatBaseImage | DescribeAttachment

interface ImageDescriptionOptions {
    /* The input attachment to describe */
    input: ImageDescriptionInput;

    /* Whether a cached description can be used */
    cached?: boolean;

    /* Whether text should be detected in the image using OCR */
    useOCR?: boolean;
}

export class ImageDescriptionManager {
    private readonly db: DatabaseManager;

    constructor(db: DatabaseManager) {
        this.db = db;
    }

    private async get(input: ImageDescriptionInput): Promise<ImageDescription | null> {
        return this.db.users.fetchFromCacheOrDatabase(
            "descriptions", input.url
        );
    }

    private async addToCache(result: ImageDescription): Promise<void> {
        await this.db.users.updateImageDescription(result.id, result);
    }

    /**
     * Check whether an image attachment is accessible, by sending a HEAD request to the URL.
     * @param input Image attachment input
     * 
     * @returns Whether it is accessible
     */
    public async accessible(input: ImageDescriptionInput): Promise<boolean> {
        try {
            const response = await fetch(input.url, { method: "HEAD" });
            return response.status === 200;

        } catch (_) {
            return false;
        }
    }

    private async fetch(input: ImageDescriptionInput): Promise<ImageBuffer> {
        return (await Utils.fetchBuffer(input.url))!;
    }

    public async describe(options: ImageDescriptionOptions): Promise<ImageDescription> {
        const { input, cached, useOCR }: Required<ImageDescriptionOptions> = {
            cached: options.cached ?? true,
            useOCR: options.useOCR ?? false,
            input: options.input
        };

        /* First, try to find a cached image description. */
        if (cached) {
            const entry: ImageDescription | null = await this.get(input);
            if (entry !== null) return entry;
        }

        const model = await this.db.bot.replicate.api.models.get("andreasjansson", "blip-2");
        const start: number = Date.now();
        
        /* Run the interrogation request, R.I.P money. */
        const description: string = (await this.db.bot.replicate.api.run(`andreasjansson/blip-2:${model.latest_version!.id}`, {
            input: {
                image: input.url,

                caption: true,
                context: "",
                use_nucleus_sampling: true,
                temperature: 1
            },

            wait: {
                interval: 750
            }
        })) as unknown as string;

        /* OCR detection results */
        let ocr: ImageOCRResult | null = null! as ImageOCRResult;

        if (useOCR) {
            /* Additionally, run OCR text recognition, to further improve results. */
            ocr = await detectText(this.db.bot, {
                url: input.url, engine: 5
            }).catch(() => null);
        }

        /* How long the description took */
        const duration: number = Date.now() - start;

        /* Buffer data of the described image */
        const buffer: ImageBuffer = await this.fetch(input);

        /* Final image description result */
        const result: ImageDescription = {
            duration, id: input.url,
            image: buffer.toString(),

            result: {
                ocr: ocr ? ocr.content : null,
                description
            }
        };

        /* Add the image description result to the cache & database. */
        await this.addToCache(result);

        return result;
    }
}