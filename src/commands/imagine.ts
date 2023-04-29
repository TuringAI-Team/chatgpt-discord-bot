import { ActionRowBuilder, AttachmentBuilder, AutocompleteInteraction, ButtonBuilder, ButtonInteraction, ButtonStyle, ChannelType, ChatInputCommandInteraction, EmbedBuilder, EmbedField, InteractionReplyOptions, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandOptionChoice, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { DatabaseImage, ImageGenerationCheckData, ImageGenerationOptions, ImageGenerationPrompt, ImageGenerationResult, StableHordeGenerationResult } from "../image/types/image.js";
import { StableHordeConfigModel, StableHordeModel, STABLE_HORDE_AVAILABLE_MODELS } from "../image/types/model.js";
import { checkImagePrompt, ModerationResult } from "../conversation/moderation/moderation.js";
import { StableHordeGenerationFilter, STABLE_HORDE_FILTERS } from "../image/types/filter.js";
import { ImageGenerationSamplers, ImageGenerationSampler } from "../image/types/image.js";
import { PremiumUpsellResponse, PremiumUpsellType } from "../command/response/premium.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { sendImageModerationMessage } from "../util/moderation/moderation.js";
import { renderIntoSingleImage } from "../image/utils/renderer.js";
import { StableHordeAPIError } from "../error/gpt/stablehorde.js";
import { Conversation } from "../conversation/conversation.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { SettingOptions } from "../db/managers/settings.js";
import { OpenAIChatMessage } from "../openai/types/chat.js";
import { handleError } from "../util/moderation/error.js";
import { StorageImage } from "../db/managers/storage.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { PagesBuilder } from "../pages/builder.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";


interface ImageGenerationProcessOptions {
	interaction: CommandInteraction;
	conversation: Conversation;
	premium: boolean;
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
}

/* List of loading indicator emojis */
const LOADING_INDICATOR_EMOJI: string[] = [ "🕐", "🕑", "🕒", "🕓", "🕔", "🕕", "🕖", "🕗", "🕘", "🕙", "🕚", "🕛" ];

/* How long an image prompt can be, max. */
const MAX_IMAGE_PROMPT_LENGTH: number = 600;

interface ImageGenerationSize {
	width: number;
	height: number;
	premium: boolean;
}

export const GENERATION_SIZES: ImageGenerationSize[] = [
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

const DEFAULT_GEN_OPTIONS: Partial<ImageGenerationOptions> = {
	params: {
		clip_skip: 1, hires_fix: false,
		post_processing: [], cfg_scale: 8, karras: true,

		sampler_name: "k_euler",
		height: 512,
		width: 512,
		steps: 35,
		n: 2
	}
};

const RATE_ACTIONS: { emoji: string; value: number; }[] = [
	{ emoji: "😖", value: 0.2 },
	{ emoji: "☹️",  value: 0.4 },
	{ emoji: "😐", value: 0.6 },
	{ emoji: "😀", value: 0.8 },
	{ emoji: "😍", value: 1.0 }
]

const DEFAULT_PROMPT: Partial<ImageGenerationPrompt> & Required<Pick<ImageGenerationPrompt, "negative">> = {
	negative: "cropped, artifacts, lowres, cropped, artifacts, lowres, lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, deformed, disfigured, mutation, extra limbs:1.5"
}

const MAX_STEP_COUNT = {
	Free: 50,
	Voter: 60,
	GuildPremium: 75,
	UserPremium: 100
}

/* ChatGPT prompt used to improve an image generation prompt & add additional tags */
const generateImageGenerationAIPrompt = (models: StableHordeModel[]): string =>
`
Your task is to improve an image generation prompt for a Stable Diffusion model, and also choose a fitting Stable Difffusion model for the prompt, depending on its tags or setting. Follow all instructions closely.

Available models:
${models.map(m => `${m.name}: ${m.summary}`).join("\n")}

You will only output the resulting prompt, model and additional tags in a minified JSON object on a single line, structured like so:
"model": Name of the model to use, determined smartly using the setting, tags and goal. It must be a model from the list given above. If not sure or using default model, set to null.
"prompt": The improved Stable Diffusion image generation prompt, fully optimized & some added keywords to improve the results. Keep it in keywords and half-sentences, not full sentences. Add many additional keywords to the prompt, to minimize the possibilities. Use commas to separate the keywords. You must add more detail & improve the prompt in general. Hallucinate & imagine new information.
          Example prompt: car driving on road, realistic car, large forest next to road, night time, realistic lighting, dark atmosphere
"negative": Structured like the "prompt", but instead should include things NOT to include the image. This is to further fine-tune image generation results. Do not prefix the keywords with "no". You do not have to include a negative prompt, set it to null if not applicable. Useful to get rid of common misconceptions, or possible mistakes by the AI.
            Example negative prompt: blurry background, artifacts, bad anatomy, cropped, low resolution, (deformed)

The user will now give you a Stable Diffusion image generation prompt, your goal is to apply the above rules and output a minified JSON object on a single line, without additional explanations or text. Do not add any other properties to the JSON object.
`.trim();

interface ImageGenerationAIPrompt {
	model: string | null;
	prompt: string;
	negative: string | null;
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
				.setName("imagine")
				.setDescription("Generate AI images using Stable Diffusion")

				.addSubcommand(builder => builder
					.setName("generate")
					.setDescription("Generate an image using Stable Diffusion")

					.addStringOption(builder => builder
						.setName("prompt")
						.setDescription("The possibilities are endless... 💫")
						.setMaxLength(MAX_IMAGE_PROMPT_LENGTH)
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("model")
						.setDescription("Which image generation model to use")
						.setAutocomplete(true)
						.setRequired(false)
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
						.setMaxValue(MAX_STEP_COUNT.UserPremium)
					)
					.addStringOption(builder => builder
						.setName("negative")
						.setDescription("Things to *not* include in the generated images")
						.setRequired(false)
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
							name: Utils.titleCase(name.replaceAll("_", " ")),
							value: name
						})))
						.setRequired(false)
					)
					.addStringOption(builder => builder
						.setName("seed")
						.setDescription("Unique image generation seed, in order to reproduce image generation results")
						.setMaxLength(40)
						.setRequired(false)
					)
					.addStringOption(builder => builder
						.setName("size")
						.setDescription("How big the generated images should be")
						.setRequired(false)
						.addChoices(...GENERATION_SIZES.map(({ width, height, premium }) => ({
							name: `${width}x${height} (${getAspectRatio(width, height)})${premium ? " 🌟" : ""}`,
							value: `${width}:${height}:${premium ?? false}`
						})))
					)
				)

				.addSubcommand(builder => builder
					.setName("ai")
					.setDescription("Let ChatGPT magically improve your prompt & pick a model")
					.addStringOption(builder => builder
						.setName("prompt")
						.setDescription("Watch ChatGPT do the rest... 🤖")
						.setMaxLength(MAX_IMAGE_PROMPT_LENGTH)
						.setRequired(true)
					)
					.addIntegerOption(builder => builder
						.setName("count")
						.setDescription("How many images to generate")
						.setRequired(false)
						.setMinValue(1)
						.setMaxValue(4)
					)
					.addStringOption(builder => builder
						.setName("sampler")
						.setDescription("The sampler is responsible for carrying out the denoising steps; they all have their pros and cons")
						.setChoices(...ImageGenerationSamplers.map(name => ({
							name: Utils.titleCase(name.replaceAll("_", " ")),
							value: name
						})))
						.setRequired(false)
					)
					.addStringOption(builder => builder
						.setName("size")
						.setDescription("How big the generated images should be")
						.setRequired(false)
						.addChoices(...GENERATION_SIZES.map(({ width, height, premium }) => ({
							name: `${width}x${height} (${getAspectRatio(width, height)})${premium ? " 🌟" : ""}`,
							value: `${width}:${height}:${premium ?? false}`
						})))
					)
					.addIntegerOption(builder => builder
						.setName("steps")
						.setDescription("How many steps to generate the images for")
						.setRequired(false)
						.setMinValue(5)
						.setMaxValue(MAX_STEP_COUNT.UserPremium)
					)
					.addNumberOption(builder => builder
						.setName("guidance")
						.setDescription("Higher values will make the AI prioritize your prompt; lower values make the AI more creative")
						.setMinValue(1)
						.setMaxValue(24)
						.setRequired(false)
					)
				)

				.addSubcommand(builder => builder
					.setName("models")
					.setDescription("View a list of all available Stable Diffusion models")
				)
		, { cooldown: {
			Free: 60 * 1000,
			Voter: 40 * 1000,
			GuildPremium: 25 * 1000,
			UserPremium: 10 * 1000
		} });
    }

	private formatLoadingIndicator(conversation: Conversation, db: DatabaseInfo, options: ImageGenerationOptions, data: ImageGenerationCheckData, index: number, moderation: ModerationResult | null): Response | null {
		/* Whether images are currently being generated */
		const busy: boolean = data.wait_time === 0;

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(`${this.bot.image.displayPrompt(options.prompt)} ${LOADING_INDICATOR_EMOJI[index % LOADING_INDICATOR_EMOJI.length]}`)
				.setDescription(`${data.wait_time > 0 ? `**${data.wait_time}**s` : "**Generating**"} ...`)
				.setColor("Aqua")
			);

		if (moderation !== null && moderation.flagged) response.addEmbed(builder => builder
			.setDescription("Your prompt may violate our **usage policies**. *If you use the bot as intended, you can ignore this notice*.")
			.setColor("Orange")
		);

		if (!busy) response.addComponent(ActionRowBuilder<ButtonBuilder>, builder => builder.addComponents(
			new ButtonBuilder()
				.setCustomId(`i-cancel:${conversation.id}:${data.id}`)
				.setStyle(ButtonStyle.Danger)
				.setLabel("Cancel")
				.setEmoji("🗑️")
		));

		return response;
	}

	private async formatImageResponse(conversation: Conversation, image: DatabaseImage, result: ImageGenerationResult, self: boolean): Promise<Response> {
		const storage: StorageImage = await this.bot.image.getImageData(result);

		const response: Response = new Response()
			.addEmbed(builder => builder
				.setTitle(`${this.bot.image.displayPrompt(image.options.prompt, 95)} 🔍`)
				.setImage(storage.url)
				.setColor("Purple")
			)
			.setEphemeral(!self);

		if (self) response.addComponent(ActionRowBuilder<ButtonBuilder>, builder => builder.addComponents(
			new ButtonBuilder()
				.setCustomId(`delete:${conversation.id}`)
				.setStyle(ButtonStyle.Danger)
				.setEmoji("🗑️")
		));

		return response;
	}

	private async formatResultResponse(conversation: Conversation, db: DatabaseInfo, options: ImageGenerationOptions, result: StableHordeGenerationResult, moderation: ModerationResult | null, censored: boolean): Promise<Response> {
		/* Render the results into a single image. */
		const buffer: Buffer = await renderIntoSingleImage(this.bot, options, result);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.bot.image.displayPrompt(options.prompt, 100))
				.setImage(`attachment://${result.id}.png`)
				.setFooter({ text: `${(result.duration / 1000).toFixed(1)}s • powered by Stable Horde` })
				.setFields(this.formatFields(conversation, options, result))
				.setColor("Purple")
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
		const rows = this.createRows(conversation, result);
		
		rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
		return response;
	}

	private formatFields(conversation: Conversation, options: ImageGenerationOptions, result: StableHordeGenerationResult): EmbedField[] {
		const fields: EmbedField[] = [];

		if (options.model.name !== STABLE_HORDE_AVAILABLE_MODELS[0].name) fields.push(
			{
				name: "Model",
				value: this.bot.image.displayNameForModel(options.model),
				inline: true
			}
		);

		if (options.params.width !== GENERATION_SIZES[0].width || options.params.height !== GENERATION_SIZES[0].height) fields.push(
			{
				name: "Size",
				value: `${options.params.width}x${options.params.height}`,
				inline: true
			}
		);

		if (options.params.steps !== DEFAULT_GEN_OPTIONS.params!.steps) fields.push(
			{
				name: "Steps",
				value: `${options.params.steps!}`,
				inline: true
			}
		);

		if (options.prompt.negative !== DEFAULT_PROMPT.negative) fields.push(
			{
				name: "Negative",
				value: Utils.removeTrailing(options.prompt.negative!.replaceAll(DEFAULT_PROMPT.negative, "").trim(), ","),
				inline: true
			}
		);

		if (result.images[0].seed) fields.push(
			{
				name: "Seed",
				value: `\`${result.images[0].seed}\``,
				inline: true
			}
		);

		if (options.params.cfg_scale !== DEFAULT_GEN_OPTIONS.params!.cfg_scale) fields.push(
			{
				name: "Guidance",
				value: `${options.params.cfg_scale}`,
				inline: true
			}
		);
		
		if (options.prompt.filter !== null) fields.push(
			{
				name: "Filter",
				value: `${options.prompt.filter.name} ${options.prompt.filter.emoji}`,
				inline: true
			}
		);

		return fields;
	}

	private createViewRows(conversation: Conversation, result: StableHordeGenerationResult): ActionRowBuilder<ButtonBuilder>[] {
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
					.setCustomId(`i-view:${conversation.user.id}:${result.id}:${image.id}`)
					.setStyle(ButtonStyle.Secondary)
					.setLabel(`U${index + 1}`)
			);
		});

		return rows;
	}

	private createRatingRow(conversation: Conversation, result: StableHordeGenerationResult): ActionRowBuilder<ButtonBuilder> {
		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(RATE_ACTIONS.map(action =>
				new ButtonBuilder()
					.setCustomId(`i-rate:${conversation.user.id}:${result.id}:${action.value}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(action.emoji)
			));
	}

	private createRows(conversation: Conversation, result: StableHordeGenerationResult): ActionRowBuilder<ButtonBuilder>[] {
		/* TODO: Work on a proper rating row, per image */
		return this.createViewRows(conversation, result);
	}

	public async handleButtonInteraction(button: ButtonInteraction, conversation: Conversation, action: string, parts: string[]): Promise<void> {
		if (button.component.style === ButtonStyle.Success) return void await button.deferUpdate();

		/* Image ID associated with this action */
		const imageID: string = parts[2];

		/* The image itself */
		const image: DatabaseImage | null = await this.bot.db.users.getImage(imageID);

		/* The user rated an image */
		if (action === "rate" && image !== null) {
			/* Given rating score */
			const score: number = parseFloat(parts[3]);
	
			/* If the image has already been rated, skip. */
			if (image.rating !== null) return void await button.deferUpdate();
			await button.deferUpdate();
	
			/* Original result embed */
			const embed: EmbedBuilder = EmbedBuilder.from(button.message.embeds[0]);

			embed.setImage(`attachment://${image.id}.png`);
			embed.setTitle(`${Utils.truncate(embed.data.title!, 95)} — ${button.component.emoji!.name!}`);
	
			await Promise.all([
				button.message.edit({
					components: button.message.components.slice(1),
					embeds: [ embed ]
				}),
	
				this.bot.db.users.updateImage({
					...image,
					rating: score
				})
			]);

		/* The user wants to view an image */
		} else if (action === "view" && image !== null) {
			/* ID of generation result of the given image, associated with this action */
			const resultID: string = parts[3];
			const result: ImageGenerationResult = image.results.find(i => i.id === resultID)!;

			await button.reply(
				(await this.formatImageResponse(conversation, image, result, conversation.id === parts[1]))
				.get() as InteractionReplyOptions
			);

			return;

		/* The user wants to cancel an image generation request */
		} else if (action === "cancel") {
			await button.deferUpdate();

			/* Just blindly try to cancel the image generation, what could go wrong? */
			await this.bot.image.cancelImageGeneration(imageID, "button").catch(() => {});
		} else {
			await button.deferUpdate();
		}
	}

	public async startGenerationProcess({ interaction, filter, guidance, model, premium, sampler, seed, size, conversation, count, steps, db, moderation, nsfw, prompt }: ImageGenerationProcessOptions): CommandResponse {
		/* Generation index, used for the loading indicator */
		let index: number = 0;

		/* Additional tags to use for the generation, as specified by the model's configuration */
		const overwrite: StableHordeConfigModel = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name)!;
		const tags: string[] = overwrite.tags ?? [];
			
		/* Add the filter to the prompt. */
		if (filter !== null) tags.push(...filter.tags);

		/* Final formatted prompt */
		const formattedTags: string | null = tags.length > 0 ? tags.join(", ") : null;
		const formattedPrompt: string = `${prompt.prompt}${formattedTags !== null ? `, ${formattedTags}` : ""}`;

		/* Image generation options */
		const options: ImageGenerationOptions = {
			...DEFAULT_GEN_OPTIONS,

			priority: true,
			nsfw: nsfw,
			shared: true,
			model: model,

			params: {
				...DEFAULT_GEN_OPTIONS.params!,

				cfg_scale: guidance ?? DEFAULT_GEN_OPTIONS.params!.cfg_scale!,
				sampler_name: sampler,

				seed_variation: seed !== null ? 1 : 1000,
				seed: seed ?? "",
				
				height: size.height,
				width: size.width,

				steps: steps,
				n: count
			},

			prompt: {
				prompt: formattedPrompt,
				negative: prompt.negative ? `${prompt.negative}, ${DEFAULT_PROMPT.negative}` : DEFAULT_PROMPT.negative,
				tags: formattedTags ?? undefined,
				filter, ai: prompt.ai
			}
		};

		/* In-progress image generation updates */
		let generationData: ImageGenerationCheckData | null = null;

		/* Whether the request was cancelled */
		let cancelled: boolean = false;

		/* Cancel this generation request. */
		const cancel = async (reason: "button" | "timeOut") => {
			if (!conversation.generatingImage) return;

			cancelled = true;
			await conversation.setImageGenerationStatus(false);

			if (reason === "button") return await new Response()
				.addEmbed(builder => builder
					.setDescription("Cancelled ❌")
					.setColor("Red")
				)
			.send(interaction).catch(() => {});
				
			else if (reason === "timeOut") return await new Response()
				.addEmbed(builder => builder
					.setDescription("This image generation request has been running for **several minutes**, and had to be cancelled automatically.\n*Try again later, when demand is lower*.")
					.setColor("Red")
				)
			.send(interaction).catch(() => {});
		}

		const onProgress = async (data: ImageGenerationCheckData) => {
			/* If the request was cancelled, don't bother updating the interaction reply. */
			if (this.bot.image.isImageGenerationCancelled(data) || cancelled) return;

			/* Build the formatted loading indicator. */
			const response: Response | null = this.formatLoadingIndicator(conversation, db, options, data, index, moderation);
			generationData = data;

			if (response !== null) {
				try {
					await interaction.editReply(response.get());
					index++;
				} catch (_) {}
			}
		}

		/* Timer to cancel the request after a specific time */
		const idleTimer: NodeJS.Timeout = setTimeout(async () => {
			if (generationData !== null) await this.bot.image.cancelImageGeneration(generationData.id, "timeOut").catch(() => {});
		}, 5 * 60 * 1000);

		try {
			await conversation.setImageGenerationStatus(true);

			/* Generate the image. */
			const result = await this.bot.image.generate(options, onProgress);
			clearTimeout(idleTimer);
			
			/* Whether the generate images are still usable & whether only some of them were censored */
			const usable: boolean = result.images.filter(i => !i.censored).length > 0;
			const censored: boolean = result.images.some(i => i.censored);

			/* Add the generated results to the database. */
			if (usable) {
				await this.bot.db.users.updateImage(this.bot.image.toDatabase(interaction.user, options, prompt, result, nsfw));

				/* Upload the generated images to the storage bucket. */
				await this.bot.db.storage.uploadImages(result);
			}

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db.user, "images");

			if (!usable) {
				await conversation.setImageGenerationStatus(false);

				return new ErrorResponse({
					interaction, command: this, emoji: null,
					message: "All of the generated images were deemed as **not safe for work**. 🔞\n_Try changing your prompt or using the bot in a channel marked as **NSFW**_."
				});
			}

			/* Generate the final message, showing the generated results. */
			const final: Response = await this.formatResultResponse(conversation, db, options, result, moderation, censored);
			await interaction.editReply(final.get());

		} catch (error) {
			/* If the image generation was blocked by Stable Horde itself, show a notice to the user. */
			if (error instanceof StableHordeAPIError && (error.isBlocked() || error.violatesTermsOfService())) {
				await sendImageModerationMessage({
					content: prompt.prompt, conversation, db, notice: error.violatesTermsOfService() ? "violates Terms of Service" : undefined,
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

			await handleError(this.bot, {
				title: "Failed to generate image using Stable Horde", 
				error: error as Error,
				reply: false
			});

			return new ErrorResponse({
				interaction, command: this, type: ErrorType.Error,
				message: "It seems like we encountered an error while trying to generate the images for you."
			});
				
		} finally {
			await conversation.setImageGenerationStatus(false);
			clearTimeout(idleTimer);
		}
	}

	public async complete(interaction: AutocompleteInteraction): Promise<CommandOptionChoice<string | number>[]> {
		/* Get all available Stable Diffusion models. */
		const models: StableHordeModel[] = this.bot.image.getModels(interaction.options.getString("model", true).toLowerCase())
			.filter(model => this.bot.image.shouldShowModel(interaction, model));

		return models.map(model => ({
			name: Utils.truncate(`${this.bot.image.displayNameForModel(model)}${this.bot.image.isModelNSFW(model) ? " 🔞" : ""} » ${this.bot.image.descriptionForModel(model)}`, 100),
			value: model.name
		}));
	};

    public async run(interaction: ChatInputCommandInteraction, db: DatabaseInfo): CommandResponse {
		const canUsePremiumFeatures: boolean = this.bot.db.users.canUsePremiumFeatures(db);
		const subscriptionType = this.bot.db.users.subscriptionType(db);

		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* Which sub-command to run */
		const action: "generate" | "ai" | "models" = interaction.options.getSubcommand(true) as any;

		if ((action === "generate" || action === "ai") && (conversation.generatingImage || conversation.generating)) return new ErrorResponse({
			interaction, command: this,
			message: `You still have ${conversation.generatingImage ? "an image generation" : "a chat"} request running, *wait for it to finish*`,
			emoji: "😔"
		});

		if (action === "ai" && !canUsePremiumFeatures) return new PremiumUpsellResponse({
			type: PremiumUpsellType.SDChatGPT
		});
		
		if (action === "generate" || action === "ai") {
			/* How many images to generate */
			const count: number = 
				interaction.options.getInteger("count")
				?? this.bot.db.settings.get<number>(db.user, SettingOptions.image_count);

			/* How many steps to generate the images with */
			const steps: number =
				interaction.options.getInteger("steps")
				?? this.bot.db.settings.get<number>(db.user, "image_steps");

			/* To which scale the AI should follow the prompt; higher values mean that the AI will respect the prompt more */
			const guidance: number = Math.round(interaction.options.getNumber("guidance") ?? DEFAULT_GEN_OPTIONS.params!.cfg_scale!);

			/* Random seed, to reproduce the generated images in the future */
			const sampler: ImageGenerationSampler = interaction.options.getString("sampler") ?? "k_euler";

			/* If the user is trying to generate an image with more steps than possible for a normal user, send them a notice. */
			if (steps > MAX_STEP_COUNT[subscriptionType] && !canUsePremiumFeatures) return new PremiumUpsellResponse({
				type: PremiumUpsellType.SDSteps
			});

			/* Size the images should be */
			const rawSize: string[] = interaction.options.getString("size") ? interaction.options.getString("size", true).split(":") : this.bot.db.settings.get<string>(db.user, SettingOptions.image_size).split(":");
			const size: ImageGenerationSize = { width: parseInt(rawSize[0]), height: parseInt(rawSize[1]), premium: rawSize[2] == "true" };

			/* If the user is trying to generate an image with more steps than possible for a normal user, send them a notice. */
			if (size.premium && !canUsePremiumFeatures) return new PremiumUpsellResponse({
				type: PremiumUpsellType.SDSize
			});

			/* Whether NSFW content can be shown */
			const nsfw: boolean = interaction.channel ? this.bot.image.shouldShowNSFW(interaction.channel) : false;

			/* Which prompt to use for generation */
			const prompt: string = interaction.options.getString("prompt", true);
			const negativePrompt: string | null = interaction.options.getString("negative");

			if (prompt.length > MAX_IMAGE_PROMPT_LENGTH || (negativePrompt ?? "").length > MAX_IMAGE_PROMPT_LENGTH) return new ErrorResponse({
				interaction, command: this,
				message: `Your specified image prompt is **too long**, it can't be longer than **${MAX_IMAGE_PROMPT_LENGTH}** characters ❌`,
			});

			if (action === "generate") {
				/* Random seed, to reproduce the generated images in the future */
				const seed: string | null = interaction.options.getString("seed") ?? null;

				/* Which filter to apply additionally */
				const filter: StableHordeGenerationFilter | null = interaction.options.getString("filter") ? STABLE_HORDE_FILTERS.find(f => f.name === interaction.options.getString("filter", true))! : null;

				/* Which generation model to use; otherwise pick the default one */
				const modelName: string = interaction.options.getString("model") ?? this.bot.db.settings.get<string>(db.user, SettingOptions.image_model);

				/* Try to get the Stable Horde model. */
				const model: StableHordeModel | null = this.bot.image.models.get(modelName) ?? null;

				if (model === null) return new ErrorResponse({
					interaction, command: this,
					message: "You specified an invalid **Stable Diffusion** model",
				});

				/* Whether the model should be shown */
				const show: boolean = this.bot.image.shouldShowModel(interaction, model);

				if (!show) return new ErrorResponse({
					interaction, command: this,
					message: "This **Stable Diffusion** model can only be used in **NSFW** channels",
					emoji: "🔞"
				});

				/* Defer the reply, as this might take a while. */
				await interaction.deferReply().catch(() => {});

				const moderation: ModerationResult | null = await checkImagePrompt({
					conversation, db, content: prompt, nsfw, model: model.name
				});

				/* If the message was flagged, send a warning message. */
				if (moderation !== null && moderation.blocked) return new ErrorResponse({
					interaction, command: this,
					message: "Your image prompt was blocked by our filters.\nTry using the bot in a channel marked as **NSFW**, or using a different prompt.\n\n*If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
					color: "Orange", emoji: null
				});

				return this.startGenerationProcess({
					interaction, guidance, model, conversation, count, moderation, nsfw, sampler, seed, size, steps, db,

					premium: canUsePremiumFeatures,
					filter: filter,
					
					prompt: {
						prompt: prompt,
						negative: negativePrompt ?? undefined,
						ai: false
					} as any
				});

			} else if (action === "ai") {
				/* Defer the reply, as this might take a while. */
				await interaction.deferReply().catch(() => {});

				/* If the message content was not provided by another source, check it for profanity & ask the user if they want to execute the request anyways. */
				const moderation: ModerationResult | null = await checkImagePrompt({
					conversation, db, content: prompt, nsfw, model: "stable_diffusion"
				});

				/* If the message was flagged, send a warning message. */
				if (moderation !== null && moderation.blocked) return new ErrorResponse({
					interaction, command: this,
					message: "Your image prompt was blocked by our filters.\nTry using the bot in a channel marked as **NSFW**, or using a different prompt.\n\n*If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
					color: "Orange"
				});

				/* Which models to show as options to ChatGPT; this is reduced in order to save tokens */
				const models: StableHordeModel[] = this.bot.image.getModels()
					.filter(model => model.nsfw ? nsfw : true);
					
				/* Messages to pass to ChatGPT */
				const messages: OpenAIChatMessage[] = [
					{
						content: generateImageGenerationAIPrompt(models),
						role: "system"
					},

					{
						content: prompt,
						role: "assistant"
					}
				];

				/* List of random phrases to display while generating a prompt */
				const randomPhrases: string[] = [
					"Improving your prompt",
					"Spicing up the scene",
					"Working on the small details",
					"Choosing an awesome model",
					"Stealing your job",
					"Enhancing the small details"
				];

				await new Response()
					.addEmbed(builder => builder
						.setTitle(`${Utils.random(randomPhrases)} **...** 🤖`)
						.setColor("Aqua")
					)
					.send(interaction);

				/* If the user's session isn't initialized yet, do that now. */
				if (!conversation.session.active) await conversation.session.init();

				/* Generate the response from ChatGPT. */
				const raw = await conversation.session.ai.chat({
					messages, model: "gpt-3.5-turbo", stream: true,
					temperature: 0.7
				});

				const data: ImageGenerationAIPrompt | null = (content => {
					try {
						const result: ImageGenerationAIPrompt = JSON.parse(content);

						if (!result.prompt) return null;
						return result;

					} catch (error) {}
					return null;
				})(raw.response.message.content);

				if (data === null) return new ErrorResponse({
					interaction, command: this,
					message: "It seems like **ChatGPT** didn't come up with a prompt for this request.",
					emoji: "😕"
				});

				/* Try to get the Stable Horde model. */
				let model: StableHordeModel | null = data.model ? this.bot.image.models.get(data.model) ?? null : null;
				if (model === null) model = this.bot.image.getModels().find(m => m.name === "stable_diffusion")!;

				return this.startGenerationProcess({
					interaction, guidance, model, conversation, count, moderation, nsfw, sampler, size, steps, db,

					premium: canUsePremiumFeatures,
					filter: null, seed: null,
					
					prompt: {
						prompt: data.prompt,
						negative: data.negative ?? undefined,
						ai: true
					} as any
				});
			}

		/* The user requested a list of all available Stable Diffusion models */
		} else if (action === "models") {
			await new PagesBuilder(interaction)
				.setColor("Aqua")
				.setPages(this.bot.image.getModels().map(model => {
					const builder = new EmbedBuilder()
						.setTitle(`${this.bot.image.displayNameForModel(model)}${this.bot.image.isModelNSFW(model) ? " 🔞" : ""}`)
						.setDescription(this.bot.image.descriptionForModel(model));

					if (model.showcases) builder.setImage(model.showcases[0]);
					return builder;
				}))
				.setListenEndMethod("delete")
				.build();
		}
    }
}