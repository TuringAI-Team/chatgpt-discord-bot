import type { Emitter } from "../utils/event.js";
import type { DiscordBot } from "../mod.js";

interface ImageConfigModelSize {
    width: number;
    height: number;
}

export interface ImageConfigModelSettings {
    /* Fixed resolution */
    forcedSize?: ImageConfigModelSize | null;

    /* The base resolution when specifying a ratio */
    baseSize?: ImageConfigModelSize | null;
}

export interface ImageModel {
	/** Display name of the model */
	name: string;

	/** Description of the model */
	description: string;

	/** ID of the model */
	id: string;

	/** Which path is used */
	path: "anything" | "kandinsky" | "sh";

    /** Various settings for the model */
    settings?: ImageConfigModelSettings;

	/** Overwrites for the request body */
	body?: Partial<ImageGenerationBody>;
}

export interface ImageStyle {
	/** Display name of the style */
	name: string;

	/** Fitting emoji for the style */
	emoji: string;

	/** Identifier of the style */
	id: string;

	/** Tags for the style */
	tags?: string[];
}

export const IMAGE_SAMPLERS = [
	"k_euler", "k_heun", "k_lms", "k_euler_a", "k_dpm_2", "k_dpm_2_a", "k_dpm_fast", "k_dpm_adaptive", "k_dpmpp_2m", "k_dpmpp_2s_a", "k_dpmpp_sde"
];

export type ImageSampler = typeof IMAGE_SAMPLERS[number]

export interface ImageGenerationRatio {
	a: number;
	b: number;
}


export interface ImageGenerationSize {
	width: number;
	height: number;
}

export interface ImageGenerationOptions {
	bot: DiscordBot;
	model: ImageModel;
	emitter: Emitter<ImageGenerationResult>;
	body: ImageGenerationBody;
}

export interface ImageUpscaleOptions {
	bot: DiscordBot;
	url: string;
}

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

export interface ImageResult {
    id: string;
    seed: number;
    status: ImageStatus;
}

export type ImageRawResult = ImageResult & {
    base64: string;
}

export type ImageGenerationAction = "generate" | "upscale"

export type ImageStatus = "success" | "filtered" | "failed"
export type ImageGenerationStatus = "queued" | "generating" | "done" | "failed"

export interface ImageGenerationResult {
    id: string;
	done: boolean;
    status: ImageGenerationStatus;
    results: ImageRawResult[];
	progress: number | null;
    error: string | null;
    cost: number | null;
}

export interface ImagePrompt {
    /** Things to include in the image */
    prompt: string;

    /** Things to *not* include in the image */
    negative?: string;

    /** Which filter was used */
    style: string;
}