import { ButtonStyles, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { createCommand } from "../config/setup.js";
import { IMAGE_MODELS } from "../models/index.js";
import EventEmitter from "events";
import { LOADING_INDICATORS } from "../../types/models/users.js";
import { mergeImages } from "../utils/image-merge.js";
import { getDefaultValues, getSettingsValue } from "../utils/settings.js";
import { chargePlan, requiredPremium } from "../utils/premium.js";

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
					["TURBO XL · Faster version of SDXL", "turboxl"],
					["Fustercluck (Cartoon) · SDXL model trained for creating cartoony style images", "c-fustercluck"],
					["Fustercluck (Anime) · SDXL model trained for creating cartoony style images", "a-fustercluck"],
					["ICBINP XL · Model trained on highly-realistic images", "icbinp"],
					["AlbedoBase XL (SDXL) · SDXL model without refiner", "albedobase"],
					//        ["DALL-E 3 · Latest DALL-E model", "dalle3"],
					/*		["Kandinsky · Multi-lingual latent diffusion model", "kandinsky"],*/
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
		user: 2 * 60 * 1000,
		voter: 1.5 * 60 * 1000,
		subscription: 1 * 60 * 1000,
	},
	interaction: async ({ interaction, options, env, premium }) => {
		let prompt = options.getString("prompt", true);
		const negative = options.getString("negative");
		let modelName = options.getString("model");
		const style = options.getString("style");
		const steps = options.getNumber("steps");
		const guidance = options.getNumber("guidance");
		const sampler = options.getString("sampler");
		const seed = options.getNumber("seed");
		const ratio = options.getString("ratio");
		const enhance = options.getString("enhance");

		if (!modelName) {
			const user = env.user;
			let setting = (await getSettingsValue(user, "image:model")) as string;
			if (!setting) {
				setting = (await getDefaultValues("image:model")) as string;
			}
			modelName = setting;
		}
		if (modelName.includes("fustercluck")) {
			let type = "c";
			if (modelName.split("-")[0] === "a") {
				type = "a";
			} else {
				type = "c";
			}
			if (type === "c") {
				prompt = `cartoon, ${prompt}`;
			}
			if (type === "a") {
				prompt = `anime, ${prompt}`;
			}
			modelName = "fustercluck";
		}
		const model = IMAGE_MODELS.find((x) => x.id === modelName);
		if (!model) {
			await interaction.edit({
				content: "The model you specified does not exist.",
				components: [
					{
						type: MessageComponentTypes.ActionRow,
						components: [
							{
								type: MessageComponentTypes.Button,
								label: "Change model Here",
								customId: "settings_open_image",
								disabled: false,
								emoji: {
									//  warning symbol
									name: "⚠️",
								},
								style: ButtonStyles.Secondary,
							},
						],
					},
				],
			});
			return;
		}
		if (model.premium && !premium) {
			await interaction.edit(requiredPremium as CreateMessageOptions);
			return;
		}
		const number: 1 | 2 = 1;
		const data: {
			prompt: string;
			number: 1 | 2;
			width: number;
			height: number;
			model?: string;
		} = {
			prompt,
			number,
			width: 1024,
			height: 1024,
		};

		const event = await model.run(interaction.bot.api, data);
		if (!event || !(event instanceof EventEmitter)) {
			await interaction.edit({
				content: "An error occurred",
			});
			return;
		}
		const loadingIndicator = LOADING_INDICATORS[Math.floor(Math.random() * 5)];
		event.on("data", async (data) => {
			if (data.status === "queued") {
				await interaction.edit({
					embeds: [
						{
							color: config.brand.color,
							title: `Waiting in queue <${loadingIndicator.emoji.animated ? "a" : ""}:${loadingIndicator.emoji.name}:${
								loadingIndicator.emoji.id
							}>`,
						},
					],
				});
			}
			if (data.status === "generating") {
				await interaction.edit({
					embeds: [
						{
							color: config.brand.color,
							title: `Generating <${loadingIndicator.emoji.animated ? "a" : ""}:${loadingIndicator.emoji.name}:${
								loadingIndicator.emoji.id
							}>`,
						},
					],
				});
			}
			if (data.status === "done") {
				// data.results with is a json that has base64 images

				let finalImage = data.results[0].base64;
				if (!finalImage || finalImage.status === "filtered") {
					await interaction.edit({
						embeds: [
							{
								color: config.brand.color,
								title: "Error",
								description: "The image was censorred cause it violates our filter rules.",
							},
						],
					});
					return;
				}
				const imgs = data.results.map((result: { base64: string }) => {
					const sfbuff = Buffer.from(result.base64, "base64");
					return sfbuff;
				});

				if (data.results.length > 1) {
					finalImage = await mergeImages(imgs, 1024 / 2, 1024 / 2);
					finalImage = finalImage.split("base64,")[1];
				}

				// from base64 to blob
				const buff = Buffer.from(finalImage, "base64");
				const blob = new Blob([buff], { type: "image/png" });

				await chargePlan(data.cost, env, "image", modelName);
				await interaction.edit({
					embeds: [
						{
							color: config.brand.color,
							title: "Done!",
							description: `${prompt}`,
							image: {
								//is a base64
								url: "attachment://image.png",
							},
						},
					],
					files: [
						{
							name: "image.png",
							blob: blob,
						},
					],
				});
			}
		});
	},
});
