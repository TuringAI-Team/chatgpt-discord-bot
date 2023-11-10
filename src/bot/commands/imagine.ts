import { ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { createCommand } from "../config/setup.js";
import { IMAGE_MODELS } from "../models/index.js";

export default createCommand({
	body: {
		name: "imagine",
		description: "Generate beautiful images with AI",
		type: "ChatInput",
		options: [
			{
				type: "String",
				name: "prompt",
				description: "The prompt that will be used for the image generation",
				max_length: 1000,
				required: true,
			},
			/*{
				type: "String",
				name: "negative",
				description: "What will the AI try not to add to the picture",
			},*/
			{
				type: "String",
				name: "model",
				description: "The model that will be used for the image generation",
				choices: [
					["SDXL · Latest Stable Diffusion model", "sdxl"],
					/*		["Kandinsky · Multi-lingual latent diffusion model", "kandinsky"],
							["Project Unreal Engine 5 · Model trained on Unreal Engine 5 renders", "pue5"],
							["Dreamshaper · A mix of several Stable Diffusion models", "dreamshaper"],
							["ICBINP · Model trained on highly-realistic images", "icbninp"],
							["Anything Diffusion · Stable Diffusion-based model trained on Anime", "anything"],*/
				],
			} /*
			{
				type: "String",
				name: "style",
				description: "The style that will be applied to the image",
				choices: [],
			},
			{
				type: "Number",
				name: "steps",
				description: "How much denoising steps will be run",
				min_value: 15,
				max_value: 100,
			},
			{
				type: "Number",
				name: "guidance",
				description: "How much the AI will prioritize your prompt",
			},
			{
				type: "String",
				name: "sampler",
				description: "The sampler that will be used for the denoising steps",
				choices: [
					["Euler"],
					["Euler A"],
					["Heun"],
					["Lms"],
					["DPM 2M"],
					["DPM 2A"],
					["DPM Fast"],
					["DPM Adaptive"],
					["DPM++ 2M", "dpmpp2m"],
					["DPM++ 2S A", "dpmpp2sa"],
					["DPM++ SDE", "dpmppsde"],
				],
			},
			{
				type: "Number",
				name: "seed",
				description: "The seed that will be used for the image generation",
				min_value: 0,
				max_value: 2147483647,
			},
			{
				type: "String",
				name: "ratio",
				description: "The aspect ratio that will be used for the image generation",
			},
			{
				type: "String",
				name: "enhance",
				description: "Shall we enhance your prompt?",
				choices: [
					["Yes, improve my prompt.", "enhanceyes"],
					["No, don't improve my prompt.", "enhanceno"],
				],
			},*/,
		],
	},
	cooldown: {
		user: 5 * 60 * 1000,
		voter: 4 * 60 * 1000,
		subscription: 1.5 * 60 * 1000,
	},
	interaction: async ({ interaction, options, env }) => {
		const prompt = options.getString("prompt", true);
		const negative = options.getString("negative");
		let modelName = options.getString("model");
		const style = options.getString("style");
		const steps = options.getNumber("steps");
		const guidance = options.getNumber("guidance");
		const sampler = options.getString("sampler");
		const seed = options.getNumber("seed");
		const ratio = options.getString("ratio");
		const enhance = options.getString("enhance");

		modelName = modelName ?? "sdxl";
		const model = IMAGE_MODELS.find((x) => x.id === modelName);
	},
});
