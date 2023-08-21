import type { ImageGenerationBody, ImageGenerationType, ImagePrompt, ImageResult } from "../../bot/types/image.js";

export interface DBImage {
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