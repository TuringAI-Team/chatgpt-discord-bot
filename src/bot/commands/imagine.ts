/* eslint-disable @typescript-eslint/no-unused-vars */
import { ApplicationCommandOptionTypes } from "discordeno";
import { createCommand } from "../helpers/command.js";

import type { ImageGenerationAction, ImageModel, ImagePrompt, ImageSampler, ImageGenerationOptions, ImageGenerationSize } from "../types/image.js";
import type { CustomInteraction } from "../types/discordeno.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { DiscordBot } from "../mod.js";

import { EmbedColor, MessageResponse, transformResponse } from "../utils/response.js";
import { moderate, moderationNotice } from "../moderation/mod.js";
import { ModerationSource } from "../moderation/types/mod.js";
import { ResponseError } from "../error/response.js";
import { getSettingsValue } from "../settings.js";

import { getLoadingIndicatorFromUser, loadingIndicatorToString } from "../../db/types/user.js";
import { IMAGE_SAMPLERS, type ImageGenerationResult } from "../types/image.js";
import { findBestSize, generate, upscale, validRatio } from "../image/mod.js";
import { handleError } from "../moderation/error.js";
import { IMAGE_MODELS } from "../image/models.js";
import { IMAGE_STYLES } from "../image/styles.js";
import { BRANDING_COLOR } from "../../config.js";
import { mergeImages } from "../utils/merge.js";
import { titleCase } from "../utils/helpers.js";
import { Emitter } from "../utils/event.js";

interface ImageStartOptions {
	bot: DiscordBot;
	interaction: CustomInteraction;
	env: DBEnvironment;
	guidance: number;
	sampler: ImageSampler;
	ratio: string;
	model: ImageModel;
	steps: number;
	count: number;
	prompt: ImagePrompt;
	action: ImageGenerationAction;
	source?: string;
}

export interface ImageFormatOptions {
	result: ImageGenerationResult;
	action: ImageGenerationAction;
	prompt: ImagePrompt;
	interaction: CustomInteraction;
	size: ImageGenerationSize;
	env: DBEnvironment;
}

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

	handler: async ({ bot, env, interaction, options }) => {
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
	
		/* Which style to apply additionally */
		const styleID = options.style?.value as string ?? getSettingsValue(env.user, "image:style");
		const style = IMAGE_STYLES.find(s => s.id === styleID)!;

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

		try {
			const result = await start({
				bot, action: "generate",
				ratio, count, env, guidance, interaction, model, sampler, steps,

				prompt: {
					prompt: prompt, negative: negativePrompt, style: style.id
				}
			});

			const message = await bot.helpers.getOriginalInteractionResponse(interaction.token);

			await bot.helpers.editMessage(
				message.channelId, message.id, transformResponse(result)
			);

		} catch (error) {
			if (error instanceof ResponseError) {
				return void await interaction.editReply(
					error.display()
				);
			}

			await interaction.editReply(
				await handleError(bot, {
					error, guild: interaction.guildId
				})
			);
		}
	}
});

async function start({
	bot, ratio: rawRatio, model, prompt, action, source, sampler, steps, guidance, count, interaction, env
}: ImageStartOptions): Promise<MessageResponse> {
	/* Parse & validate the given aspect ratio. */
	const ratio = validRatio(rawRatio);

	if (ratio === null) throw new ResponseError({
		message: "You specified an **invalid** aspect ratio"
	});

	/* Find the best size for the specified aspect ratio. */
	const size = !model.settings?.forcedSize
		? findBestSize(ratio, model) : model.settings.forcedSize;

	/* The image generation style to apply additionally */
	const style = IMAGE_STYLES.find(s => s.id === prompt.style)!;

	/* The formatted prompt, to pass to the API */
	let formattedPrompt = prompt.prompt;
	if (style.tags) formattedPrompt += `, ${style.tags.join(", ")}`;

	/* Just why... */
	await interaction.reply(
		await formatResult({ action, env, interaction, prompt, size, result: {
			cost: 0, done: false, error: null, id: "", progress: null, results: [], status: "generating"
		}})
	);

	const handler = async (data: ImageGenerationResult) => {
		try {
			await interaction.editReply(
				await formatResult({ result, action, prompt, interaction, env, size })
			);
		} catch { /* Stub */ }
	};

	const emitter = new Emitter<ImageGenerationResult>();
	emitter.on(handler);

	/* Image generation options */
	const options: ImageGenerationOptions = {
		body: {
			prompt: formattedPrompt,
			negative_prompt: prompt.negative ? prompt.negative : undefined,

			sampler, steps, width: size.width, height: size.height, ratio,
			number: count, cfg_scale: guidance
		},

		bot, model, emitter
	};

	const result = action === "upscale" && source
		? await upscale({ bot, url: source })
		: await generate(options);

	/* Whether the generated images are still usable */
	const usable: boolean = result.results.filter(i => i.status === "success").length > 0;
	const failed: boolean = result.status === "failed";

	if (failed) throw new ResponseError({
		message: `**${result.error ?? "The images failed to generate"}**; *please try your request again later*.`
	});

	if (!usable) throw new ResponseError({
		message: "All of the generated images were deemed as **not safe for work**", emoji: "🔞"
	});

	/* TODO: Pay-as-you-go charges */

	return await formatResult({
		result, action, prompt, interaction, env, size
	});
}

/** Format the image generation result into a clean embed. */
async function formatResult(
	{ action, env, interaction, prompt, result, size }: ImageFormatOptions
): Promise<MessageResponse> {
	if (!result.done) {
		const indicator = getLoadingIndicatorFromUser(env.user);
		const emoji = loadingIndicatorToString(indicator);

		return { embeds: {
			title: displayPrompt({ action, interaction, prompt }),
			description: `**${result.progress && result.progress <= 1 ? `${Math.floor(result.progress * 100)}%` : titleCase(result.status)}** ... ${emoji}`,
			color: EmbedColor.Orange
		} };
	}

	return {
		embeds: {
			title: displayPrompt({ action, interaction, prompt }),
			image: { url: "attachment://result.png", ...size },
			color: BRANDING_COLOR
		},

		file: {
			name: "result.png",
			blob: (await mergeImages({ result, size })).toString("base64")
		}
	};
}

/** Display the user's given prompt nicely. */
function displayPrompt(
	{ action, interaction, prompt }: Pick<ImageFormatOptions, "action" | "interaction" | "prompt">
) {
	return `**${prompt.prompt}** — @${interaction.user.username}${action !== null ? ` ${action === "upscale" ? "🔎" : ""}` : ""}`;
}