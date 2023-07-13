import { randomUUID } from "crypto";

import { DatabaseImage, ImageGenerationBody, ImageGenerationOptions, ImageGenerationResult, ImageGenerationType, ImagePartialGenerationResult, ImageResult } from "./types/image.js";
import { ImageGenerationRatio, ImageGenerationSize } from "../commands/imagine.js";
import { ImageUpscaleOptions, ImageUpscaleResult } from "./types/upscale.js";
import { ImagePrompt, ImagePromptEnhancer } from "./types/prompt.js";
import { ImageConfigModels, ImageModel } from "./types/model.js";
import { StorageImage } from "../db/managers/storage.js";
import { StreamBuilder } from "../util/stream.js";
import { TuringAPIPath } from "../turing/api.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export type ImageAPIPath = "sdxl" | "kandinsky" | "runpod" | "sh"

export class ImageModelManager {
    private models: ImageModel[];

    constructor(manager: ImageManager) {
        this.models = ImageConfigModels.map(m => ({
            ...m,
            
            settings: {
                ...m.settings,
                modifyResolution: true
            },

            body: {}, tags: []
        }));
    }

    public all(): ImageModel[] {
        return this.models;
    }

    public default(): ImageModel {
        return this.models[0];
    }

    public get(id: string): ImageModel {
        const existing = this.models.find(m => m.id === id) ?? null;
        if (existing === null) throw new Error("Invalid model");

        return existing;
    }
}

export class ImageManager {
    private readonly bot: Bot;
    public readonly model: ImageModelManager;

    constructor(bot: Bot) {
        this.bot = bot;
        this.model = new ImageModelManager(this);
    }

    public prompt(prompt: ImagePrompt, length: number = 250): string {
        return Utils.truncate(prompt.prompt, length); 
    }

    public url(db: DatabaseImage, image: ImageResult): StorageImage {
        return this.bot.db.storage.imageURL(db, image, "images");
    }

    public validRatio(ratio: string, max: number = 3): ImageGenerationRatio | null {
        const [ a, b ] = ratio.split(":").map(Number);
        if (!a || !b || isNaN(a) || isNaN(b)) return null;

        /* Make sure that the ratio is in the valid range. */
        if (a <= 0 || b <= 0 || a / b > max || b / a > max) return null;

        return { a, b };
    }

    public findBestSize({ a, b }: ImageGenerationRatio, maxWidth: number = 768, maxHeight: number = 768, step: number = 64): ImageGenerationSize {
        const pixelCount = Math.max(512 * 512, Math.ceil(a * b / step / step) * step * step);

        let width = Math.round(Math.sqrt(pixelCount * a / b));
        let height = Math.round(Math.sqrt(pixelCount * b / a));

        width += width % step > 0 ? step - width % step : 0;
        height += height % step > 0 ? step - height % step : 0;

        return width > maxWidth ? {
            width: maxWidth, height: Math.round(maxWidth * b / a / step) * step
        } : height > maxHeight ? {
            width: Math.round(maxHeight * a / b / step) * step, height: maxHeight
        } : {
            width, height
        };
    }
    
    public async enhance(prompt: ImagePrompt, enhancer: ImagePromptEnhancer): Promise<ImagePrompt> {
        return {
            ...prompt,

            original: prompt.prompt,
            mode: enhancer.id
        };
    }

    public async upscale({ image, prompt }: ImageUpscaleOptions): Promise<ImageUpscaleResult> {
        const response: any = await this.bot.turing.request({
            path: "image/sdxl", method: "POST", body: {
                action: "upscale", prompt, image: image.toString(), stream: false
            }
        });

        return {
            results: response.images.map((data: any) => ({
                id: randomUUID(), base64: data.base64, seed: data.seed,
                status: data.finishReason === "SUCCESS" ? "success" : "filtered"
            })), cost: response.cost, id: randomUUID(), status: "done", error: null
        };
    }

    public async generate({ body, model, progress }: ImageGenerationOptions): Promise<ImageGenerationResult> {
        const path: TuringAPIPath = `image/${model.path}`;

        return await new StreamBuilder<
            any, ImagePartialGenerationResult, ImageGenerationResult
        >({
            body: {
                ...body, ...model.body ?? {}, stream: true
            },

            error: response => this.bot.turing.error(response, path, "error"),
            headers: this.bot.turing.headers(),
            url: this.bot.turing.url(path),

            progress
        }).run();
    }

    public toDatabase(prompt: ImagePrompt, { body, model }: ImageGenerationOptions, result: ImageGenerationResult | ImageUpscaleResult, time: string, action: ImageGenerationType): DatabaseImage {
        return {
            id: result.id, created: time, action, prompt, model: model.id,
            
            options: body as ImageGenerationBody,
            cost: result.cost ?? 0,
            
            results: result.results.map(image => ({
                id: image.id,
                status: image.status,
                seed: image.seed
            }))
        };
    }
}