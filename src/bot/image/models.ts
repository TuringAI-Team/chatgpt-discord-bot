import type { ImageModel } from "../types/image.js";

export const IMAGE_MODELS: ImageModel[] = [
	{
		name: "Kandinsky",
		description: "Multi-lingual latent diffusion model",
		id: "kandinsky",
		path: "kandinsky",

		settings: {
			baseSize: { width: 768, height: 768 }
		}
	},

	{
		name: "SDXL",
		description: "Latest Stable Diffusion model",
		id: "sdxl",
		path: "sh",

		settings: {
			forcedSize: { width: 1024, height: 1024 }
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
			model: "Project Unreal Engine 5"
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
];