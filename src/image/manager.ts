import { randomUUID } from "crypto";

import { DatabaseImage, ImageGenerationBody, ImageGenerationOptions, ImageGenerationType, ImageRawGenerationResult, ImageResult } from "./types/image.js";
import { StorageImage } from "../db/managers/storage.js";
import { TuringAPIRawResponse } from "../turing/api.js";
import { ImageAPIError } from "../error/gpt/image.js";
import { ImagePrompt } from "./types/prompt.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export type ImageAPIModel = "sdxl" | "kandinsky"

export class ImageManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public prompt(prompt: ImagePrompt, length: number = 250): string {
        return Utils.truncate(prompt.prompt, length); 
    }

    public url(db: DatabaseImage, image: ImageResult): StorageImage {
        return this.bot.db.storage.imageURL(db, image, "images");
    }

    public async generate({ body }: ImageGenerationOptions): Promise<ImageRawGenerationResult> {
        const raw = await this.bot.turing.request<ImageRawGenerationResult>({
            path: "image", method: "POST", raw: true, body: {
                ...body,
                
                width: body.action !== "upscale" ? body.width : undefined,
                height: body.action !== "upscale" ? body.height : undefined,

                ai: body.action === "upscale" || body.action === "img2img" ? "sdxl" : body.ai
            }
        });

        if (!raw.success) await this.error(raw, body.ai);

        raw.data.images = raw.data.images.map(image => ({
            ...image, id: randomUUID()
        }));

        raw.data.id = randomUUID();
        return raw.data;
    }

    public toDatabase(prompt: ImagePrompt, body: ImageGenerationBody, result: ImageRawGenerationResult, time: string, action: ImageGenerationType): DatabaseImage {
        return {
            id: result.id, created: time, action, prompt, model: body.model!,
            
            cost: result.cost,
            options: body,
            
            results: result.images.map(image => ({
                id: image.id,
                reason: image.finishReason,
                seed: image.seed
            }))
        };
    }

    private async error(raw: TuringAPIRawResponse, path: ImageAPIModel): Promise<void> {
        throw new ImageAPIError({
            code: 400, endpoint: `/image/${path}`, body: raw.data
        });
    }
}