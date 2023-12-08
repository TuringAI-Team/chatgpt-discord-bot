import EventEmitter from "node:events";
import { Api } from "../api.js";
import { DALLE3, GPT16K, GPT3_5, GPT4 } from "./openai.js";
import { Claude, Claude_instant } from "./text/anthropic.js";
import openchat from "./text/openchat.js";
import { sdxl, OpenJourneyDiffussion, Deliberate, majicMIXR } from "./stablehorde.js";
import kandinsky from "./kandinsky.js";
import { Zephyr } from "./text/pawan.js";
import fastSdxl from "./fast-sdxl.js";

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

type UnionFromNumber<T extends number, Tuple extends number[] = []> = Tuple["length"] extends T
	? Tuple[number] | T
	: UnionFromNumber<T, [...Tuple, Tuple["length"]]>;

export type Model = {
	id: string;
	name: string;
	description: string;
};

export type ChatModel = Prettify<
	Model & {
		emoji: { name: string; id: string };
		maxTokens: 2048 | 4096 | 8192;
		premium?: boolean;
	}
>;

export type GPTModel = Prettify<
	ChatModel & {
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
>;

export type AnthropicModel = Prettify<
	ChatModel & {
		run: (
			api: Api,
			data: {
				messages: { role: string; content: string }[];
				max_tokens?: number;
				temperature?: number;
			},
		) => EventEmitter | NonNullable<unknown>;
	}
>;

export type OpenChatModel = Prettify<
	ChatModel & {
		run: (
			api: Api,
			data: {
				messages: { role: string; content: string }[];
				max_tokens?: number;
				temperature?: number;
				model?: string;
			},
		) => Promise<EventEmitter | NonNullable<unknown>>;
	}
>;
export type PawanChatModel = Prettify<
	ChatModel & {
		run: (
			api: Api,
			data: {
				messages: { role: string; content: string }[];
				max_tokens?: number;
				temperature?: number;
				model?: string;
			},
		) => Promise<EventEmitter | NonNullable<unknown>>;
	}
>;

export const CHAT_MODELS: (GPTModel | AnthropicModel | OpenChatModel)[] = [
	/*GPT4, GPT3_5, GPT16K, Claude,*/
	Claude_instant,
	openchat,
	Zephyr,
];
export type GenericParam = Parameters<Api["image"]["sh"]>[0];

export const IMAGE_MODELS: (GenericModel<GenericParam> | DALLEModel<2>)[] = [
	sdxl,
	//OpenJourneyDiffussion,
	//Deliberate,
	//majicMIXR,
	//DALLE3,
	//kandinsky,
	fastSdxl,
];
export type ImageModel = Pick<Model, "name" | "id">;

export type ImageModelFixed = Prettify<
	ImageModel & {
		fixedSize: { width: number; height: number };
		baseSize?: never;
		from?: never;
		to?: never;
		variableSizes?: never;
	}
>;

export type ImageModelBase = Prettify<
	ImageModel & {
		fixedSize?: never;
		baseSize: { width: number; height: number };
		from?: never;
		to?: never;
		variableSizes?: never;
	}
>;

export type ImageModelFromTo = Prettify<
	ImageModel & {
		fixedSize?: never;
		baseSize?: never;
		from: { width: number; height: number };
		to: { width: number; height: number };
		variableSizes?: never;
	}
>;

export type ImageModelVariable<T extends number> = Prettify<
	ImageModel & {
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
	}
>;

export type ImageModelNone = Prettify<
	ImageModel & {
		fixedSize?: never;
		baseSize?: never;
		from?: never;
		to?: never;
		variableSizes?: never;
	}
>;

export type DALLEModel<T extends number> = Prettify<
	ImageModelVariable<T> & {
		run: (
			api: Api,
			data: {
				prompt: string;
				number: 1 | 2 | 3 | 4;
				size?: "256x256" | "512x512" | "1024x1024";
				image?: string;
			},
		) => EventEmitter | NonNullable<unknown>;
	}
>;

export type KandinskyModel = Prettify<
	ImageModelFromTo & {
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
	}
>;

export type GenericModel<T extends NonNullable<unknown>> = Prettify<
	ImageModelFromTo & { run: (api: Api, data: T) => EventEmitter | unknown }
>;

export type ControlNetModel = Prettify<
	ImageModelNone & {
		run: (
			api: Api,
			data: {
				prompt: string;
				image: string;
				model: "normal" | "canny" | "hough" | "hed" | "depth2img" | "pose" | "seg";
			},
		) => EventEmitter | NonNullable<unknown>;
	}
>;

export type UpscalerModel = Prettify<
	ImageModelNone & {
		run: (
			api: Api,
			data: {
				image: string;
				upscaler?:
					| "GFPGAN"
					| "RealESRGAN_x4plus"
					| "RealESRGAN_x2plus"
					| "RealESRGAN_x4plus_anime_6B"
					| "NMKD_Siax"
					| "4x_AnimeSharp";
			},
		) => EventEmitter | NonNullable<unknown>;
	}
>;

export type ImageVisionModel = Prettify<
	ImageModelNone & {
		run: (
			api: Api,
			data: {
				model: ("blip2" | "ocr")[];
				image: string;
			},
		) => EventEmitter | NonNullable<unknown>;
	}
>;
