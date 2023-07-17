import { Awaitable } from "discord.js";

import { ImageGenerationRatio } from "../../commands/imagine.js";
import { ImageSampler } from "./sampler.js";
import { ImagePrompt } from "./prompt.js";
import { ImageModel } from "./model.js";

export interface ImageResult {
    id: string;
    seed: number;
    status: ImageStatus;
}

export type ImageRawResult = ImageResult & {
    base64: string;
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

export type ImageGenerationType = "generate" | "upscale"

export interface ImageGenerationBody {
    prompt: string;
    negative_prompt?: string;
    image?: string;
    width: number;
    height: number;
    steps: number;
    number: number;
    sampler?: ImageSampler;
    cfg_scale?: number;
    seed?: number;
    style?: string;
    model?: string;
    strength?: number;
    ratio: ImageGenerationRatio;
}

export interface ImageGenerationOptions {
    body: Partial<ImageGenerationBody>;
    model: ImageModel;
    progress: (data: ImagePartialGenerationResult) => Awaitable<void>;
}

type ImageStatus = "success" | "filtered" | "failed"

export type ImageGenerationStatus = "queued" | "generating" | "done" | "failed"

export interface ImagePartialGenerationResult {
    id: string;
    status: ImageGenerationStatus;
    results: ImageRawResult[];
    progress: number | null;
    cost: number | null;
    error: string | null;
}

export interface ImageGenerationResult {
    id: string;
    status: ImageGenerationStatus;
    results: ImageRawResult[];
    time: number | null;
    error: string | null;
    cost: number | null;
}