import { ImagePrompt } from "./prompt.js";
import { ImageSampler } from "./sampler.js";

export interface ImageResult {
    id: string;
    seed: number;
    reason: ImageFinishReason;
}

export interface DatabaseImage {
    /* Unique identifier of the generation request */
    id: string;

    /* Which model was used */
    model: string;

    /* When the generation was completed */
    created: string;

    /* Which action was performed */
    action: ImageGenerationType;

    /* Which prompt was used to generate the image */
    prompt: ImagePrompt;

    /* Generation options used for this image */
    options: ImageGenerationBody;

    /* Generated image results */
    results: ImageResult[];

    /* How much this generation costs */
    cost: number;
}

export type ImageGenerationType = "generate" | "img2img" | "upscale"

export interface ImageGenerationPrompt {
    text: string;
    weight?: number;
}

export interface ImageGenerationBody {
    prompts: ImageGenerationPrompt[];
    image?: string;
    action?: ImageGenerationType;
    width: number;
    height: number;
    steps: number;
    number: number;
    sampler: ImageSampler;
    cfg_scale?: number;
    seed?: number;
    style?: string;
    model?: string;
    strength?: number;
}

export interface ImageGenerationOptions {
    body: ImageGenerationBody;
}

type ImageFinishReason = "SUCCESS" | "CONTENT_FILTERED" | "ERROR"

export interface ImageRawGeneration {
    base64: string;
    finishReason: ImageFinishReason;
    seed: number;
    id: string;
}

export interface ImageRawGenerationResult {
    images: ImageRawGeneration[];
    cost: number;
    id: string;
}