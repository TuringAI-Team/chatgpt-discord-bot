import type { ImageModel } from "../types/image.js";

export const IMAGE_MODELS: ImageModel[] = [
	{
		name: "Kandinsky",
		description: "Multi-lingual latent diffusion model",
		id: "kandinsky",

		settings: {
			baseSize: { width: 768, height: 768 },
			random: true
		}
	}
];