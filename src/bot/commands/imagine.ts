/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApplicationCommandOptionTypes } from "discordeno";
import { createCommand } from "../helpers/command.js";

import { IMAGE_SAMPLERS, ImageSampler } from "../types/image.js";
import { IMAGE_MODELS } from "../image/models.js";
import { IMAGE_STYLES } from "../image/styles.js";

import { moderate, moderationNotice } from "../moderation/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { ResponseError } from "../error/response.js";
import { getSettingsValue } from "../settings.js";

const DEFAULT_GEN_OPTIONS = {
	cfg_scale: 7, steps: 30, number: 2, sampler: "k_euler_a"
};

export default createCommand({
	name: "imagine",
	description: "Generate beautiful images using AI",

	cooldown: {
		user: 5 * 60 * 1000,
		voter: 4 * 60 * 1000,
		subscription: 1.5 * 60 * 1000
	},

	options: {
		prompt: {
			type: ApplicationCommandOptionTypes.String,
			description: "The possibilities are endless... 💫",
			required: true
		},

		model: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which model to use",

			choices: IMAGE_MODELS.map(m => ({
				name: `${m.name} • ${m.description}`, value: m.id
			}))
		},

		style: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which style to use",

			choices: IMAGE_STYLES.map(s => ({
				name: `${s.emoji} ${s.name}`, value: s.id
			}))
		},

		negative: {
			type: ApplicationCommandOptionTypes.String,
			description: "Things to *not include in the generated images",
		},

		count: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "How many images to generate",
			minValue: 1, maxValue: 4
		},

		ratio: {
			type: ApplicationCommandOptionTypes.String,
			description: "Which aspect ratio the images should have, e.g. 16:9 or 1.5:1",
		},

		steps: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "How many steps to generate the image for",
			minValue: 15, maxValue: 50
		},

		guidance: {
			type: ApplicationCommandOptionTypes.Integer,
			description: "Higher values will make the AI prioritize your prompt; lower values make the AI more creative",
			minValue: 1, maxValue: 24
		},

		sampler: {
			type: ApplicationCommandOptionTypes.String,
			description: "The sampler responsible for carrying out the denoising steps",

			choices: IMAGE_SAMPLERS.map(s => ({
				name: s.toUpperCase(), value: s
			}))
		},
	},

	handler: async ({ bot, env, options }) => {
		/* How many images to generate */
		const count = options.count?.value as number ?? DEFAULT_GEN_OPTIONS.number;

		/* How many steps to generate the images with */
		const steps = options.steps?.value as number ?? DEFAULT_GEN_OPTIONS.steps;

		/* To which scale the AI should follow the prompt; higher values mean that the AI will respect the prompt more */
		const guidance = options.guidance?.value as number ?? DEFAULT_GEN_OPTIONS.cfg_scale;

		/* The sampler responsible for carrying out the denoising steps */
		const sampler: ImageSampler = options.sampler?.value as string ?? DEFAULT_GEN_OPTIONS.sampler;

		/* Which prompt to use for generation */
		const prompt = options.prompt.value as string;
		const negativePrompt = options.prompt?.value as string ?? null;

		/* Which model to use */
		const modelID = options.model?.value as string ?? getSettingsValue(env.user, "image:model");
		const model = IMAGE_MODELS.find(m => m.id === modelID)!;

		/* Ratio that the images should have */
		const ratio: string = options.ratio?.value as string ?? "1:1";

		if (model.settings?.forcedSize && ratio !== "1:1") throw new ResponseError({
			message: `**${model.name}** has a fixed resolution of \`${model.settings.forcedSize.width}×${model.settings.forcedSize.height}\`; *you cannot modify the aspect ratio*`
		});

		/* Moderate the user's prompt. */
		const moderation = await moderate({
			bot, env, content: prompt, source: ModerationSource.ImagePrompt
		});

		if (moderation.blocked) return moderationNotice({ result: moderation });

		return {
			content: "WIP"
		};
	}
});