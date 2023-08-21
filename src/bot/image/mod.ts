import { randomUUID } from "crypto";

import type { ImageGenerationOptions, ImageGenerationRatio, ImageGenerationResult, ImageGenerationSize, ImageGenerationType, ImageModel, ImagePrompt, ImageUpscaleOptions } from "../types/image.js";
import type { DBImage } from "../../db/types/image.js";

export async function generate({ bot, model, emitter, body }: ImageGenerationOptions) {
	const request = await bot.api.image[model.id](body as any);

	request.on("data", (data: ImageGenerationResult) => {
		emitter.emit(data);
	});

	return await emitter.wait(3 * 60 * 1000);
}

export async function upscale({ bot, url }: ImageUpscaleOptions): Promise<ImageGenerationResult> {
	const response = await bot.api.image.upscale({
		upscaler: "RealESRGAN_x2plus", image: url, stream: false
	} as any) as {
		cost: number;
		result: string;
	};

	return {
		results: [ {
			id: randomUUID(), seed: -1, status: "success",
			base64: response.result
		} ],
		
		cost: response.cost, id: randomUUID(),
		status: "done", error: null, done: true
	};
}

export function resultToDatabase(
	prompt: ImagePrompt,
	{ body, model }: ImageGenerationOptions,
	result: ImageGenerationResult,
	time: string,
	action: ImageGenerationType
): DBImage {
	return {
		id: result.id, created: time, action, prompt, model: model.id,
		
		options: body,
		cost: result.cost ?? 0,
		
		results: result.results.map(image => ({
			id: image.id,
			status: image.status,
			seed: image.seed
		}))
	};
}

export function validRatio(ratio: string, max: number = 3): ImageGenerationRatio | null {
	const [ a, b ] = ratio.split(":").map(Number);
	if (!a || !b || isNaN(a) || isNaN(b)) return null;

	/* Make sure that the ratio is in the valid range. */
	if (a <= 0 || b <= 0 || a / b > max || b / a > max) return null;

	return { a, b };
}

export function findBestSize({ a, b }: ImageGenerationRatio, model: ImageModel, step: number = 64): ImageGenerationSize {
	const max = model.settings?.baseSize ?? { width: 512, height: 512 };
	const pixelCount = Math.max(max.width * max.height, Math.ceil(a * b / step / step) * step * step);

	let width = Math.round(Math.sqrt(pixelCount * a / b));
	let height = Math.round(Math.sqrt(pixelCount * b / a));

	width += width % step > 0 ? step - width % step : 0;
	height += height % step > 0 ? step - height % step : 0;

	return width > max.width ? {
		width: max.width, height: Math.round(max.width * b / a / step) * step
	} : height > max.height ? {
		width: Math.round(max.height * a / b / step) * step, height: max.height
	} : {
		width, height
	};
}