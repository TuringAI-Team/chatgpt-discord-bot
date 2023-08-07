import { ImageGenerationBody } from "./image.js";
import { ImageAPIPath } from "../manager.js";

interface ImageConfigModelSize {
    width: number;
    height: number;
}

export interface ImageConfigModelSettings {
    /* Fixed resolution */
    forcedSize?: ImageConfigModelSize | null;

    /* The base resolution when specifying a ratio */
    baseSize?: ImageConfigModelSize | null;

    /** Whether this model can be chosen randomly */
    random?: boolean;
}

export type ImageModelSettings = Required<ImageConfigModelSettings>

export interface ImageConfigModel {
    /** Display name of the model */
    name: string;

    /** Identifier of the model */
    id: string;

    /** Description of the model */
    description: string;

    /** Various settings for the model */
    settings?: ImageConfigModelSettings;

    /** Additional tags for the prompt, e.g. trigger words */
    tags?: string[];

    /** API path for this model */
    path: ImageAPIPath;

    /** Additional body to use for the API request */
    body?: Partial<ImageGenerationBody>;
}

export type ImageModel = Required<Omit<ImageConfigModel, "settings">> & {
    settings: ImageModelSettings;
}

export const ImageConfigModels: ImageConfigModel[] = [
    {
        name: "Kandinsky",
        description: "Multi-lingual latent diffusion model",
        id: "kandinsky",
        path: "kandinsky",

        settings: {
            baseSize: { width: 768, height: 768 },
            random: true
        }
    },

    {
        name: "SDXL",
        description: "Latest Stable Diffusion model",
        id: "sdxl",
        path: "sh",

        settings: {
            forcedSize: { width: 1024, height: 1024 },
            random: true
        },

        body: {
            model: "SDXL_beta::stability.ai#6901", number: 2
        }
    },

    {
        name: "Project Unreal Engine 5",
        description: "Trained to look like Unreal Engine 5 renders",
        id: "ue5",
        path: "sh",

        body: {
            model: "stable_diffusion"
        }
    },

    {
        name: "Dreamshaper",
        description: "A mix of several Stable Diffusion models",
        id: "dreamshaper",
        path: "sh",

        body: {
            model: "Dreamshaper"
        }
    },
    
    {
        name: "I Can't Believe It's Not Photography",
        description: "Highly photo-realistic Stable Diffusion model",
        id: "icbinp",
        path: "sh",
        
        body: {
            model: "ICBINP - I Can't Believe It's Not Photography"
        }
    },

    {
        name: "Anything Diffusion",
        description: "Stable Diffusion-based model for generating anime",
        id: "anything-diffusion",
        path: "anything"
    }
]