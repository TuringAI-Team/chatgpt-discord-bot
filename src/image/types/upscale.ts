import { ImageGenerationStatus, ImageRawResult } from "./image.js";
import { ImageBuffer } from "../../chat/types/image.js";

export interface ImageUpscaleOptions {
    prompt: string;
    image: ImageBuffer;
}

export interface ImageUpscaleResult {
    results: ImageRawResult[];
    id: string;
    cost: number;
    status: ImageGenerationStatus;
    error: null;
}