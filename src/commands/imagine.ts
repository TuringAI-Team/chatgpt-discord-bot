import { ActionRow, ActionRowBuilder, Attachment, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, EmbedField, SlashCommandBuilder, User } from "discord.js";
import { setTimeout as delay } from "timers/promises";

import { Command, CommandCooldown, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { DatabaseImage, ImageGenerationCheckData, ImageGenerationOptions, ImageGenerationPrompt, ImageGenerationResult, ImageInput, StableHordeGenerationResult } from "../image/types/image.js";
import { StableHordeGenerationFilter, STABLE_HORDE_FILTERS } from "../image/types/filter.js";
import { ImageGenerationSamplers, ImageGenerationSampler } from "../image/types/image.js";
import { PremiumUpsellResponse, PremiumUpsellType } from "../command/response/premium.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { StableHordeConfigModels, StableHordeModel } from "../image/types/model.js";
import { ImagineInteractionHandler, ImagineInteractionHandlerData } from "../interactions/imagine.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { InteractionHandlerResponse } from "../interaction/handler.js";
import { renderIntoSingleImage } from "../image/utils/renderer.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { StableHordeAPIError } from "../error/gpt/stablehorde.js";
import { ModerationResult } from "../moderation/moderation.js";
import { StorageImage } from "../db/managers/storage.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";
import { ALLOWED_FILE_EXTENSIONS } from "../chat/types/image.js";
import { NoticeResponse } from "../command/response/notice.js";
import { CommandSpecificCooldown } from "../command/command.js";

interface ImageGenerationProcessOptions {
	interaction: CommandInteraction | ButtonInteraction;
	user: User;
	filter: StableHordeGenerationFilter | null;
	model: StableHordeModel;
	guidance: number;
	sampler: ImageGenerationSampler;
	seed: string | null;
	size: ImageGenerationSize;
	steps: number;
	count: number;
	moderation: ModerationResult | null;
	db: DatabaseInfo;
	prompt: ImageGenerationPrompt;
	nsfw: boolean;
	action: StableHordeImageAction | null;
	source: ImageInput | null;
}

/* How long an image prompt can be, max. */
export const MaxImagePromptLength: number = 600

interface ImageGenerationSize {
	width: number;
	height: number;
	premium: boolean;
}

export const GenerationSizes: ImageGenerationSize[] = [
	{ width: 512,  height: 512,  premium: false },
	{ width: 256,  height: 256,  premium: false },
	{ width: 512,  height: 256,  premium: false },
	{ width: 576,  height: 448,  premium: false },
	{ width: 768,  height: 512,  premium: false },
	{ width: 512,  height: 896,  premium: true  },
	{ width: 1024, height: 640,  premium: true  },
	{ width: 768,  height: 768,  premium: true  },
	{ width: 1024, height: 1024, premium: true  }
]

const DefaultGenerationOptions: Partial<ImageGenerationOptions> = {
	params: {
		clip_skip: 1, hires_fix: false,
		post_processing: [], cfg_scale: 8, karras: true,

		sampler_name: "k_euler",
		height: 512,
		width: 512,
		steps: 30,
		n: 2
	}
};

export interface RateAction {
	emoji: string;
	value: number;
}

export const RateActions: RateAction[] = [
	{ emoji: "😖", value: 0.2 },
	{ emoji: "☹️",  value: 0.4 },
	{ emoji: "😐", value: 0.6 },
	{ emoji: "😀", value: 0.8 },
	{ emoji: "😍", value: 1.0 }
]

const DefaultPrompt: Partial<ImageGenerationPrompt> & Required<Pick<ImageGenerationPrompt, "negative">> = {
	negative: "cropped, artifacts, lowres, cropped, artifacts, lowres, lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, deformed, disfigured, mutation, extra limbs"
}

const MaxStepGenerationCount = {
	free: 50,
	voter: 60,
	subscription: 100,
	plan: 100
}

export type StableHordeImageAction = "upscale" | "variation"

export const ImageGenerationCooldown: CommandSpecificCooldown = {
	free: 100 * 1000,
	voter: 80 * 1000,
	subscription: 45 * 1000
}

/**
 * Calculate the aspect ratio for a given resolution.
 * 
 * @param width Width 
 * @param height Height
 * 
 * @returns Aspect ratio, as a string 
 */
export const getAspectRatio = (width: number, height: number): string => {
	const gcd = (a: number, b: number): number => b ? gcd(b, a % b) : a;
	const ratio = gcd(width, height);

	return `${width / ratio}:${height / ratio}`;
}

export default class ImagineCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
		, {
			cooldown: ImageGenerationCooldown,
			synchronous: true
		});

		this.builder = new SlashCommandBuilder()
			.setName("imagine")
			.setDescription("Generate AI images using Stable Diffusion")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MaxImagePromptLength)
				.setRequired(true)
			)
			.addStringOption(builder => builder
				.setName("model")
				.setDescription("Which image generation model to use")
				.setRequired(false)
				.addChoices(...Array.from(this.bot.image.models.values()).map(model => ({
					name: this.bot.image.model.display(model),
					value: model.id
				})))
			)
			.addStringOption(builder => builder
				.setName("filter")
				.setDescription("Which filter to apply additionally")
				.addChoices(...STABLE_HORDE_FILTERS.map(filter => ({
					name: `${filter.name} ${filter.emoji}`,
					value: `${filter.name}`
				})))
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("negative")
				.setDescription("Things to *not* include in the generated images")
				.setRequired(false)
			)
			.addIntegerOption(builder => builder
				.setName("count")
				.setDescription("How many images to generate")
				.setRequired(false)
				.setMinValue(1)
				.setMaxValue(4)
			)
			.addIntegerOption(builder => builder
				.setName("steps")
				.setDescription("How many steps to generate the images for")
				.setRequired(false)
				.setMinValue(5)
				.setMaxValue(MaxStepGenerationCount.subscription)
			)
			.addNumberOption(builder => builder
				.setName("guidance")
				.setDescription("Higher values will make the AI prioritize your prompt; lower values make the AI more creative")
				.setMinValue(1)
				.setMaxValue(24)
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("sampler")
				.setDescription("The sampler is responsible for carrying out the denoising steps; they all have their pros and cons")
				.setChoices(...ImageGenerationSamplers.map(name => ({
					name: Utils.titleCase(name), value: name
				})))
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("seed")
				.setDescription("Unique image generation seed, in order to reproduce image generation results")
				.setMaxLength(32)
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("size")
				.setDescription("How big the generated images should be")
				.setRequired(false)
				.addChoices(...GenerationSizes.map(({ width, height, premium }) => ({
					name: `${width}x${height} (${getAspectRatio(width, height)})${premium ? " 🌟" : ""}`,
					value: `${width}:${height}:${premium ?? false}`
				})))
			)
			.addAttachmentOption(builder => builder
				.setName("source")
				.setDescription("Source image to transform using the prompt")
				.setRequired(false)
			);
    }

	private displayPrompt(user: User, prompt: ImageGenerationPrompt, action: StableHordeImageAction | null): string {
		return `**${Utils.truncate(this.bot.image.displayPrompt(prompt), 150)}** — @${user.username}${action !== null ? ` ${action === "upscale" ? "🔎" : "🔄"}` : ""}`;
	}

	private formatPartialResponse(user: User, db: DatabaseInfo, options: ImageGenerationProcessOptions, data: ImageGenerationCheckData, moderation: ModerationResult | null): Response | null {
		/* Whether images are currently being generated */
		const busy: boolean = data.wait_time === 0;

		/* The user's loading indicator */
		const loadingEmoji: string = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(this.bot, db.user)
		);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, options.prompt, options.action))
				.setDescription(`${data.wait_time > 0 ? `**${data.wait_time}**s` : "**Generating**"} ... ${loadingEmoji}`)
				.setFooter({ text: "powered by Stable Horde" })
				.setColor("Orange")
			);

		if (moderation !== null && moderation.flagged) response.addEmbed(builder => builder
			.setDescription("Your prompt may violate our **usage policies**. *If you use the bot as intended, you can ignore this notice*.")
			.setColor("Red")
		);

		if (!busy) response.addComponent(ActionRowBuilder<ButtonBuilder>, builder => builder.addComponents(
			new ButtonBuilder()
				.setCustomId(`i:cancel:${user.id}:${data.id}`)
				.setStyle(ButtonStyle.Danger)
				.setLabel("Cancel")
				.setEmoji("🗑️")
		));

		return response;
	}

	private async formatResultResponse(user: User, db: DatabaseInfo, options: ImageGenerationOptions, result: StableHordeGenerationResult, moderation: ModerationResult | null, censored: boolean, action: StableHordeImageAction | null): Promise<Response> {
		/* Render the results into a single image. */
		const buffer: Buffer = await renderIntoSingleImage(this.bot, options, result);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, options.prompt, action))
				.setImage(`attachment://${result.id}.png`)
				.setFooter({ text: `${(result.duration / 1000).toFixed(1)}s • powered by Stable Horde` })
				.setFields(this.formatFields(user, options, result))
				.setColor(this.bot.branding.color)
			)
			.addAttachment(new AttachmentBuilder(buffer).setName(`${result.id}.png`));

		if (moderation !== null && moderation.flagged) response.addEmbed(builder => builder
			.setDescription(`Your prompt may violate our **usage policies**. *If you use the bot as intended, you can ignore this notice.*`)
			.setColor("Orange")
		);

		if (censored) response.addEmbed(builder => builder
			.setDescription(`Some of the generated images were deemed as **not safe for work**; try modifying your prompt or using the bot in a channel marked as **NSFW** instead.`)
			.setColor("Orange")
		);

		/* Add the various message component rows. */
		const rows = this.buildToolbar(user, result, action);
		
		rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
		return response;
	}

	private formatFields(user: User, options: ImageGenerationOptions, result: StableHordeGenerationResult): EmbedField[] {
		const fields: EmbedField[] = [];

		if (options.model.id !== StableHordeConfigModels[0].id) fields.push(
			{
				name: "Model",
				value: this.bot.image.model.name(options.model),
				inline: true
			}
		);

		if (options.params.width !== GenerationSizes[0].width || options.params.height !== GenerationSizes[0].height) fields.push(
			{
				name: "Size",
				value: `${options.params.width}x${options.params.height}`,
				inline: true
			}
		);

		if (options.params.steps !== DefaultGenerationOptions.params!.steps) fields.push(
			{
				name: "Steps",
				value: `${options.params.steps!}`,
				inline: true
			}
		);

		if (options.prompt.negative !== DefaultPrompt.negative) fields.push(
			{
				name: "Negative prompt",
				value: Utils.removeTrailing(options.prompt.negative!.replace(DefaultPrompt.negative, "").trim(), ","),
				inline: true
			}
		);

		if (options.params.cfg_scale !== DefaultGenerationOptions.params!.cfg_scale) fields.push(
			{
				name: "Guidance",
				value: `${options.params.cfg_scale}`,
				inline: true
			}
		);
		
		if (options.prompt.filter) fields.push(
			{
				name: "Filter",
				value: `${options.prompt.filter.name} ${options.prompt.filter.emoji}`,
				inline: true
			}
		);

		return fields;
	}

	private async formatSingleImageResponse(user: User, db: DatabaseInfo, image: DatabaseImage, result: ImageGenerationResult): Promise<Response> {
		const storage: StorageImage = await this.bot.image.getImageData(result);

		const response: Response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, image.prompt, "upscale"))
				.setImage(storage.url)
				.setColor(this.bot.branding.color)
				.setFooter({ text: "powered by Stable Horde" })
			);

		/* Add the rating row to the image. */
		response.addComponent(ActionRowBuilder<ButtonBuilder>, this.buildRatingRow(user, image, result));

		return response;
	}

	private buildRatingRow(user: User, image: DatabaseImage, result: ImageGenerationResult): ActionRowBuilder<ButtonBuilder> {
		/* Index of the single generation result */
		const index: number = image.results.findIndex(i => i.id === result.id)!;

		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(RateActions.map(action =>
				new ButtonBuilder()
					.setCustomId(`i:rate:${user.id}:${image.id}:${index}:${action.value}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(action.emoji)
			));
	}

	private buildRow(user: User, result: StableHordeGenerationResult, action: StableHordeImageAction): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		/* How many images to display per row */
		const perRow: number = 4;

		/* How many rows to display */
		const rowCount: number = Math.ceil(result.images.length / perRow);
		
		for (let i = 0; i < rowCount; i++) {
			rows.push(new ActionRowBuilder());
		}

		result.images.forEach((image, index) => {
			const which: number = Math.ceil((index + 1) / perRow) - 1;
			const row = rows[which];

			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`i:${action}:${user.id}:${result.id}:${index}`)
					.setLabel(`${action.charAt(0).toUpperCase()}${index + 1}`)
					.setStyle(image.censored ? ButtonStyle.Danger : ButtonStyle.Secondary)
					.setDisabled(image.censored)
			);
		});

		return rows;
	}

	private buildToolbar(user: User, result: StableHordeGenerationResult, action: StableHordeImageAction | null): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		
		if (action !== "upscale") {
			rows.push(...this.buildRow(user, result, "upscale"));
			if (action !== "variation") rows.push(...this.buildRow(user, result, "variation"));
		}

		if (rows[0] && action === null) {
			rows[0].addComponents(
				new ButtonBuilder()
					.setEmoji("🔄")
					.setCustomId(`i:redo:${user.id}:${result.id}`)
					.setStyle(ButtonStyle.Secondary)
			);
		}

		return rows;
	}

	public async handleButtonInteraction(handler: ImagineInteractionHandler, interaction: ButtonInteraction, db: DatabaseInfo, data: ImagineInteractionHandlerData): InteractionHandlerResponse {
		if (interaction.component.style === ButtonStyle.Success) return void await interaction.deferUpdate();

		/* Image ID associated with this action */
		const imageID: string = data.imageID;

		/* The image itself */
		const image: DatabaseImage | null = await this.bot.db.users.getImage(imageID);
		if (image === null) return void await interaction.deferUpdate();

		if (data.action === "upscale" || data.action === "variation" || data.action === "redo") {
			/* All components on the original message */
			const components: ActionRow<ButtonComponent>[] = interaction.message.components as ActionRow<ButtonComponent>[];

			components.forEach(
				row => row.components.forEach(button => {
					if (button.customId === interaction.customId) {
						(button.data as any).style = ButtonStyle.Primary;
						(button.data as any).disabled = true;
					}
				})
			);

			await interaction.message.edit({
				embeds: [ EmbedBuilder.from(interaction.message.embeds[0]).setImage(`attachment://${image.id}.png`), ...interaction.message.embeds.slice(1) ], components
			});
		}

		/* The user wants to generate variations for an image */
		if (data.action === "variation") {
			/* The selected result to create variations for */
			const result: ImageGenerationResult = image.results.find((_, index) => index === data.resultIndex)!;
			const storage: StorageImage = await this.bot.image.getImageData(result);

			await interaction.deferReply().catch(() => {});

			const response = this.startImageGeneration({
				interaction,
				
				model: image.options.model,
				nsfw: image.nsfw, prompt: image.prompt,
				filter: null, user: interaction.user,

				guidance: image.options.params.cfg_scale!,
				sampler: image.options.params.sampler_name!, seed: image.options.params.seed ?? null,
				steps: image.options.params.steps!, count: image.options.params.n!, moderation: null, db, 
				
				source: { url: storage.url },
				action: "variation",

				size: {
					width: image.options.params.width!,
					height: image.options.params.height!,

					premium: false
				}
			});

			const type = this.bot.db.users.type(db);
			
			const duration: number | null = (ImageGenerationCooldown as any)[type.type] ?? null;
			if (duration !== null) await handler.applyCooldown(interaction, db, duration);

			return response;

		/* The user wants to re-do an image */
		} else if (data.action === "redo") {
			await interaction.deferReply().catch(() => {});

			const response = this.startImageGeneration({
				interaction,
				
				model: image.options.model,
				nsfw: image.nsfw, prompt: image.prompt,
				filter: null, user: interaction.user,

				guidance: image.options.params.cfg_scale!,
				sampler: image.options.params.sampler_name!, seed: image.options.params.seed ?? null,
				steps: image.options.params.steps!, count: image.options.params.n!, moderation: null, db, 
				
				action: null, source: null,

				size: {
					width: image.options.params.width!,
					height: image.options.params.height!,

					premium: false
				}
			});

			const type = this.bot.db.users.type(db);
			
			const duration: number | null = (ImageGenerationCooldown as any)[type.type] ?? null;
			if (duration !== null) await handler.applyCooldown(interaction, db, duration);

			return response;

		/* The user wants to upscale an image */
		} else if (data.action === "upscale" && image !== null && data.resultIndex !== null) {
			/* ID of generation result of the given image, associated with this action */
			const result: ImageGenerationResult = image.results.find((_, index) => index === data.resultIndex)!;
			return await this.formatSingleImageResponse(interaction.user, db, image, result);

		/* The user wants to cancel an image generation request */
		} else if (data.action === "cancel") {
			await interaction.deferUpdate();
			if (data.id !== db.user.id) return;

			/* Just blindly try to cancel the image generation, what could go wrong? */
			await this.bot.image.cancelImageGeneration(imageID, "button").catch(() => {});

		/* The user wants to rate an upscaled image */
		} else if (data.action === "rate") {
			if (interaction.user.id !== db.user.id) return void await interaction.deferUpdate();

			/* The selected result to rate */
			const result: ImageGenerationResult = image.results.find((_, index) => index === data.resultIndex)!;

			/* Find the corresponding rating action. */
			const rating: RateAction = RateActions.find(r => r.emoji === interaction.component.emoji?.name)!;

			/* All components on the original message */
			const row: ActionRow<ButtonComponent> = interaction.message.components[0] as ActionRow<ButtonComponent>;

			row.components.forEach(button => {
				if (button.customId === interaction.customId) (button.data as any).style = ButtonStyle.Primary;
				(button.data as any).disabled = true;
			});

			await interaction.message.edit({
				embeds: interaction.message.embeds, components: [ row ]
			});

			await interaction.deferUpdate();

		} else {
			await interaction.deferUpdate();
		}
	}

	public async startImageGeneration(options: ImageGenerationProcessOptions): CommandResponse {
		const {
			interaction, filter, guidance, model, sampler, seed, size, user, count, steps, db, moderation, nsfw, prompt, source, action
		} = options;
		
		const tags: string[] = [];
		if (model.tags) tags.push(...model.tags);
			
		/* Add the filter to the prompt. */
		if (filter !== null) tags.push(...filter.tags);

		/* Final formatted prompt */
		const formattedTags: string | null = tags.length > 0 ? tags.join(", ") : null;
		const formattedPrompt: string = `${prompt.prompt}${formattedTags !== null && options.action !== "variation" ? `, ${formattedTags}` : ""}`;

		/* Image generation options */
		const body: ImageGenerationOptions = {
			...DefaultGenerationOptions,

			priority: true,
			nsfw: nsfw,
			shared: true,
			model: model,

			params: {
				...DefaultGenerationOptions.params!,

				cfg_scale: guidance ?? DefaultGenerationOptions.params!.cfg_scale!,
				sampler_name: sampler,

				seed_variation: seed !== null ? 1 : 1000,
				seed: seed ?? "",
				
				height: size.height,
				width: size.width,
				
				denoising_strength: 0.6,
				steps: steps,
				n: count
			},

			prompt: {
				prompt: formattedPrompt,
				negative: options.action === "variation" && prompt.negative ? prompt.negative : prompt.negative && options.action !== "variation" ? `${prompt.negative}, ${DefaultPrompt.negative}` : DefaultPrompt.negative,
				tags: formattedTags ?? undefined, filter: filter ?? undefined
			},

			source
		};

		/* In-progress image generation updates */
		let generationData: ImageGenerationCheckData | null = null;

		/* Whether the request was cancelled */
		let cancelled: boolean = false;

		/* Cancel this generation request. */
		const cancel = async (reason: "button" | "timeOut") => {
			cancelled = true;

			if (reason === "button") return await new Response()
				.addEmbed(builder => builder
					.setDescription("Cancelled ❌")
					.setColor("Red")
				)
			.send(interaction).catch(() => {});
				
			else if (reason === "timeOut") return await new Response()
				.addEmbed(builder => builder
					.setDescription("This image generation request has been running for **several minutes** and had to be cancelled automatically. *Try again later, when demand is lower*.")
					.setColor("Red")
				)
			.send(interaction).catch(() => {});
		}

		const onProgress = async (data: ImageGenerationCheckData) => {
			/* If the request was cancelled, don't bother updating the interaction reply. */
			if (this.bot.image.isImageGenerationCancelled(data) || cancelled) return;

			/* Build the formatted loading indicator. */
			const response: Response | null = this.formatPartialResponse(user, db, options, data, moderation);
			generationData = data;

			if (response !== null) {
				try {
					await interaction.editReply(response.get());
				} catch (_) {}
			}
		}

		/* Timer to cancel the request after a specific time */
		const idleTimer: NodeJS.Timeout = setTimeout(async () => {
			if (generationData !== null) await this.bot.image.cancelImageGeneration(generationData.id, "timeOut").catch(() => {});
		}, 5 * 60 * 1000);

		try {
			/* Generate the image. */
			const result = await this.bot.image.generate(body, onProgress);
			clearTimeout(idleTimer);
			
			/* Whether the generate images are still usable & whether only some of them were censored */
			const usable: boolean = result.images.filter(i => !i.censored).length > 0;
			const censored: boolean = result.images.some(i => i.censored);

			/* Add the generated results to the database. */
			if (usable) {
				await this.bot.db.users.updateImage(
					this.bot.image.toDatabase(interaction.user, body, prompt, result, nsfw)
				);

				/* Upload the generated images to the storage bucket. */
				await this.bot.db.storage.uploadImages(result);
				await delay(1000);
			}

			if (!usable) {
				return new ErrorResponse({
					interaction, command: this, emoji: null,
					message: "All of the generated images were deemed as **not safe for work**. 🔞\n_Try changing your prompt or using the bot in a channel marked as **NSFW**_."
				});
			}

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db, "images");
			
			await this.bot.db.metrics.changeImageMetric({
				models: { [model.id]: "+1" },
				counts: { [count]: "+1" },
				steps: { [steps]: "+1" },
				kudos: `+${result.kudos}`
			});

			await this.bot.db.plan.expenseForImage(
				db, result
			);

			/* Generate the final message, showing the generated results. */
			const final: Response = await this.formatResultResponse(user, db, body, result, moderation, censored, action);
			await final.send(interaction);

		} catch (error) {
			/* If the image generation was blocked by Stable Horde itself, show a notice to the user. */
			if (error instanceof StableHordeAPIError && (error.isBlocked() || error.violatesTermsOfService())) {
				await this.bot.moderation.sendImageModerationMessage({
					content: prompt.prompt, user: interaction.user, db,
					notice: error.violatesTermsOfService() ? "violates Terms of Service" : undefined,
					result: { blocked: true, flagged: true, source: "image" }
				});

				return new ErrorResponse({
					interaction, command: this, emoji: null,
					message: "Your image prompt was flagged as inappropriate by **[Stable Horde](https://stablehorde.net)**.\n*If you continue to violate the usage policies, we may have to take moderative actions*."
				});
			}

			/* If we got blocked by Stable Horde for some reason. show a notice to the user. */
			if (error instanceof StableHordeAPIError && error.blockedByAbusePrevention()) return new ErrorResponse({
				interaction, command: this, emoji: "😔",
				message: "We are currently unable to generate images using **[Stable Horde](https://stablehorde.net)**; please try your request again in a few minutes."
			});

			/* If the request got cancelled, delete the interaction & clean up, if possible. */
			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Cancelled) return void await cancel(error.options.data.data as any);

			return await this.bot.error.handle({
				title: "Failed to generate image using Stable Horde", notice: "It seems like we encountered an error while trying to generate the images for you.", error
			});
				
		} finally {
			clearTimeout(idleTimer);
		}
	}

    public async run(interaction: ChatInputCommandInteraction, db: DatabaseInfo): CommandResponse {
		const canUsePremiumFeatures: boolean = this.bot.db.users.canUsePremiumFeatures(db);
		const subscriptionType = this.bot.db.users.type(db);
		
		/* How many images to generate */
		const count: number = 
			interaction.options.getInteger("count")
			?? this.bot.db.settings.get<number>(db.user, "image:count");

		/* How many steps to generate the images with */
		const steps: number =
			interaction.options.getInteger("steps")
			?? Math.min(this.bot.db.settings.get<number>(db.user, "image:steps"), MaxStepGenerationCount[subscriptionType.type]);

		/* To which scale the AI should follow the prompt; higher values mean that the AI will respect the prompt more */
		const guidance: number = Math.round(interaction.options.getNumber("guidance") ?? DefaultGenerationOptions.params!.cfg_scale!);

		/* Random seed, to reproduce the generated images in the future */
		const sampler: ImageGenerationSampler = interaction.options.getString("sampler") ?? "k_euler";

		/* If the user is trying to generate an image with more steps than possible for a normal user, send them a notice. */
		if (steps > MaxStepGenerationCount[subscriptionType.type] && !canUsePremiumFeatures) return new PremiumUpsellResponse({
			type: PremiumUpsellType.SDSteps
		});

		/* Size the images should be */
		const rawSize: string[] = interaction.options.getString("size") ? interaction.options.getString("size", true).split(":") : this.bot.db.settings.get<string>(db.user, "image:size").split(":");
		const size: ImageGenerationSize = { width: parseInt(rawSize[0]), height: parseInt(rawSize[1]), premium: rawSize[2] == "true" };

		/* If the user is trying to generate an image with more steps than possible for a normal user, send them a notice. */
		if (size.premium && !canUsePremiumFeatures) return new PremiumUpsellResponse({
			type: PremiumUpsellType.SDSize
		});

		/* Whether NSFW content can be shown */
		const nsfw: boolean = interaction.channel ? this.bot.image.nsfw(interaction.channel) : false;

		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);
		const negativePrompt: string | null = interaction.options.getString("negative");

		/* Random seed, to reproduce the generated images in the future */
		const seed: string | null = interaction.options.getString("seed") ?? null;

		/* Which filter to apply additionally */
		const filterName: string | null = interaction.options.getString("filter");
		
		const filter: StableHordeGenerationFilter | null = filterName !== null
			? STABLE_HORDE_FILTERS.find(f => f.name === filterName)! : null;

		/* Which generation model to use; otherwise pick the default one */
		const modelName: string = interaction.options.getString("model") ?? this.bot.db.settings.get<string>(db.user, "image:model");

		/* Try to get the Stable Horde model. */
		const model: StableHordeModel | null = this.bot.image.get(modelName);

		if (model === null) return new ErrorResponse({
			interaction, command: this,
			message: "You specified an invalid **Stable Diffusion** model"
		});

		/* Whether the model should be shown */
		const show: boolean = this.bot.image.model.usable(model, interaction);

		if (!show) return new ErrorResponse({
			interaction, command: this, emoji: "🔞",
			message: "This **Stable Diffusion** model can only be used in **NSFW** channels"
		});

		/* Defer the reply, as this might take a while. */
		await interaction.deferReply().catch(() => {});

		const moderation: ModerationResult = await this.bot.moderation.checkImagePrompt({
			db, user: interaction.user, content: prompt, nsfw, model: model.id
		});

		/* If the message was flagged, send a warning message. */
		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your image prompt"
        });

		/* Source attachment, specified in command options */
		const sourceAttachment: Attachment | null = interaction.options.getAttachment("source", false);

		if (sourceAttachment !== null) {
			/* Extension of the source attachment */
			const extension: string = Utils.fileExtension(sourceAttachment.name);

			if (!ALLOWED_FILE_EXTENSIONS.includes(extension)) return void await new NoticeResponse({
				message: `The **\`source\`** option only supports the following files » ${ALLOWED_FILE_EXTENSIONS.map(ext => `\`.${ext}\``).join(", ")} ❌`,
				color: "Red"
			}).send(interaction);
		}

		/* Source image to use for Image2Image */
		const source: ImageInput | null = sourceAttachment !== null ? {
			url: sourceAttachment.url
		} : null;

		return this.startImageGeneration({
			interaction, guidance, model, count, moderation, nsfw, sampler, seed, size, steps, db,
			filter: filter, user: interaction.user,
			
			prompt: {
				prompt: prompt, negative: negativePrompt ?? undefined
			},
			
			action: null, source: source
		});
    }
}