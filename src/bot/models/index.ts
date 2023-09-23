import EventEmitter from "node:events";
import { Api } from "../api.js";

interface Model {
	name: string;
	description: string;
}

interface ChatModel extends Model {
	emoji: { name: string; id: string };
	maxTokens: 2048 | 4096 | 8192;
}

export interface GPTModel extends ChatModel {
	run: (
		api: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
			plugins?: string[];
		},
	) => EventEmitter | NonNullable<unknown>;
}

export interface AnthropicModel extends ChatModel {
	run: (
		api: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
		},
	) => EventEmitter | NonNullable<unknown>;
}

export interface OpenChatModel extends ChatModel {
	run: (
		api: Api,
		data: {
			messages: { role: string; content: string }[];
			max_tokens?: number;
			temperature?: number;
		},
	) => EventEmitter | NonNullable<unknown>;
}

type ImageModel = Pick<Model, "name">;

export type ImageModelFixed = ImageModel & {
	fixedSize: { width: number; height: number };
	baseSize?: never;
	from?: never;
	to?: never;
	variableSizes?: never;
};

export type ImageModelBase = ImageModel & {
	fixedSize?: never;
	baseSize: { width: number; height: number };
	from?: never;
	to?: never;
	variableSizes?: never;
};

export type ImageModelFromTo = ImageModel & {
	fixedSize?: never;
	baseSize?: never;
	from: { width: number; height: number };
	to: { width: number; height: number };
	variableSizes?: never;
};

type UnionFromNumber<T extends number, Tuple extends number[] = []> = Tuple["length"] extends T
	? Tuple[number] | T
	: UnionFromNumber<T, [...Tuple, Tuple["length"]]>;

type ImageModelVariable<T extends number> = ImageModel & {
	fixedSize?: never;
	baseSize?: never;
	from?: never;
	to?: never;
	variableSizes: {
		[K in UnionFromNumber<T>]: {
			width: number;
			height: number;
		};
	};
};

export type ImageModelNone = ImageModel & {
	fixedSize?: never;
	baseSize?: never;
	from?: never;
	to?: never;
	variableSizes?: never;
};

type ImageModelStableHorde<T extends Record<string, ImageModelBase | ImageModelFixed | ImageModelFromTo>> = ImageModel & {
	fixedSize?: never;
	baseSize?: never;
	from?: never;
	to?: never;
	variableSizes?: never;
	models: {
		[K in keyof T]: Omit<T[K], "name">;
	};
};

export type DALLEModel<T extends number> = ImageModelVariable<T> & {
	run: (
		api: Api,
		data: {
			prompt: string;
			number: 1 | 2 | 3 | 4;
			size?: "256x256" | "512x512" | "1024x1024";
			image?: string;
		},
	) => EventEmitter | NonNullable<unknown>;
};

export type KandinskyModel = ImageModelFromTo & {
	run: (
		api: Api,
		data: {
			prompt: string;
			steps?: number;
			number?: number;
			negative_prompt?: string;
			guidance_scale?: number;
			width?: number;
			height?: number;
			cfg_scale?: number;
			model_version?: "2.1" | "2.2";
		},
	) => EventEmitter | NonNullable<unknown>;
};

export type ControlNetModel = ImageModelNone & {
	run: (
		api: Api,
		data: {
			prompt: string;
			image: string;
			model: "normal" | "canny" | "hough" | "hed" | "depth2img" | "pose" | "seg";
		},
	) => EventEmitter | NonNullable<unknown>;
};

export type UpscalerModel = ImageModelNone & {
	run: (
		api: Api,
		data: {
			image: string;
			upscaler?: "GFPGAN" | "RealESRGAN_x4plus" | "RealESRGAN_x2plus" | "RealESRGAN_x4plus_anime_6B" | "NMKD_Siax" | "4x_AnimeSharp";
		},
	) => EventEmitter | NonNullable<unknown>;
};

export type ImageVisionModel = ImageModelNone & {
	run: (
		api: Api,
		data: {
			model: ("blip2" | "ocr")[];
			image: string;
		},
	) => EventEmitter | NonNullable<unknown>;
};

export type StableHordeModel<T extends Record<string, ImageModelBase | ImageModelFixed | ImageModelFromTo>> = ImageModelStableHorde<T> & {
	run: (
		api: Api,
		data: {
			prompt: string;
			negative_prompt?: string;
			image?: string;
			width?: number;
			height?: number;
			steps?: number;
			strength?: number;
			sampler?:
				| "k_lms"
				| "k_heun"
				| "k_euler"
				| "k_euler_a"
				| "k_dpm_2"
				| "k_dpm_2_a"
				| "DDIM"
				| "k_dpm_fast"
				| "k_dpm_adaptive"
				| "k_dpmpp_2m"
				| "k_dpmpp_2s_a"
				| "k_dpmpp_sde";
			cfg_scale?: number;
			seed?: number;
			model?: "majicMIX realistic" | "Deliberate" | "OpenJourney Diffusion";
			nsfw?: boolean;
		},
	) => EventEmitter | NonNullable<unknown>;
};
