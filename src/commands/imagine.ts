import { ActionRow, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, EmbedField, SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { DatabaseImage, ImageGenerationBody, ImageGenerationOptions, ImageGenerationPrompt, ImageGenerationType, ImageResult } from "../image/types/image.js";
import { ImagineInteractionHandler, ImagineInteractionHandlerData } from "../interactions/imagine.js";
import { PremiumUpsellResponse, PremiumUpsellType } from "../command/response/premium.js";
import { ImageSampler, ImageSamplers } from "../image/types/sampler.js";
import { InteractionHandlerResponse } from "../interaction/handler.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { ImageStyle, ImageStyles } from "../image/types/style.js";
import { RateAction, RateActions } from "../image/types/rate.js";
import { CommandSpecificCooldown } from "../command/command.js";
import { renderIntoSingleImage } from "../image/utils/merge.js";
import { ModerationResult } from "../moderation/moderation.js";
import { ErrorResponse } from "../command/response/error.js";
import { ImagePrompt } from "../image/types/prompt.js";
import { ImageAPIError } from "../error/gpt/image.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

interface ImageGenerationProcessOptions {
	interaction: CommandInteraction | ButtonInteraction;
	user: User;
	guidance: number;
	sampler: ImageSampler;
	seed: number | null;
	size: ImageGenerationSize;
	steps: number;
	count: number;
	moderation: ModerationResult | null;
	db: DatabaseInfo;
	prompt: ImagePrompt;
	action: ImageGenerationType;
	image: ImageBuffer | null;
}

/* How long an image prompt can be, max. */
export const MaxImagePromptLength: number = 200

interface ImageGenerationSize {
	width: number;
	height: number;
	premium: boolean;
}

export const GenerationSizes: ImageGenerationSize[] = [
	{ width: 512, height: 512, premium: false },
	{ width: 256, height: 256, premium: false },
	{ width: 512, height: 256, premium: false },
	{ width: 576, height: 448, premium: false },
	{ width: 768, height: 512, premium: true  },
	{ width: 512, height: 896, premium: true  },
	{ width: 896, height: 512, premium: true  }
]

const DefaultGenerationOptions: Omit<Partial<ImageGenerationBody>, "prompts" | "action"> = {
	steps: 30, cfg_scale: 10, sampler: "K_EULER", number: 2
}

const DefaultPrompt: Partial<ImagePrompt> = {
	negative: "cropped, artifacts, lowres, cropped, artifacts, lowres, lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, deformed, disfigured, mutation, extra limbs"
}

const MaxStepGenerationCount = {
	free: 50,
	voter: 60,
	subscription: 100,
	plan: 100
}

export const ImageGenerationCooldown: CommandSpecificCooldown = {
	free: 180 * 1000,
	voter: 160 * 1000,
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
			.setDescription("Generate beautiful images using AI")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MaxImagePromptLength)
				.setRequired(true)
			)
			.addStringOption(builder => builder
				.setName("style")
				.setDescription("Which style to use")
				.addChoices(...ImageStyles.map(style => ({
					name: `${style.name} ${style.emoji}`, value: style.id
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
				.setDescription("The sampler responsible for carrying out the denoising steps")
				.setChoices(...ImageSamplers.map(name => ({
					name: Utils.titleCase(name), value: name
				})))
				.setRequired(false)
			)
			.addIntegerOption(builder => builder
				.setName("seed")
				.setDescription("Unique image generation seed, in order to reproduce image generation results")
				.setMinValue(1)
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("size")
				.setDescription("Which resolution the images should have")
				.setRequired(false)
				.addChoices(...GenerationSizes.map(({ width, height, premium }) => ({
					name: `${width}x${height} (${getAspectRatio(width, height)})${premium ? " 🌟" : ""}`,
					value: `${width}:${height}`
				})))
			);
    }

	private displayPrompt(user: User, prompt: ImagePrompt, action: ImageGenerationType | null): string {
		return `**${this.bot.image.prompt(prompt, 150)}** — @${user.username}${action !== null ? ` ${action === "upscale" ? "🔎" : action === "img2img" ? "🔄" : ""}` : ""}`;
	}

	private async formatPartialResponse(user: User, db: DatabaseInfo, options: ImageGenerationProcessOptions, moderation: ModerationResult | null): Promise<Response> {
		/* The user's loading indicator */
		const loadingEmoji: string = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(this.bot, db.user)
		);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, options.prompt, options.action))
				.setDescription(`**Generating** ... ${loadingEmoji}`)
				.setColor("Orange")
			);

		if (moderation !== null && moderation.flagged) {
			const { embeds } = await this.bot.moderation.message({
				name: "Your prompt", result: moderation
			});

			response.addEmbed(embeds[0]);
		}

		return response;
	}

	private async buildResultResponse(user: User, db: DatabaseImage, action: ImageGenerationType, moderation: ModerationResult | null): Promise<Response> {
		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, db.prompt, action))
				.setColor(this.bot.branding.color)
			);

		if (db.results.length > 1) {
			/* Render the results into a single image. */
			const image: Buffer = await renderIntoSingleImage(this.bot, db);

			response.embeds[0].setImage(`attachment://${db.id}.png`);
			response.addAttachment(new AttachmentBuilder(image).setName(`${db.id}.png`));
		} else {
			const { url } = this.bot.image.url(db, db.results[0]);
			response.embeds[0].setImage(url);
		}

		if (action !== "upscale") response.embeds[0].setFields(this.formatFields(db));

		if (moderation !== null && moderation.flagged) {
			const { embeds } = await this.bot.moderation.message({
				name: "Your prompt", result: moderation
			});

			response.addEmbed(embeds[0]);
		}

		const censored: boolean = db.results.some(i => i.reason === "CONTENT_FILTERED");

		if (censored) response.addEmbed(builder => builder
			.setDescription(`Some of the generated images were deemed as **not safe for work**.`)
			.setColor("Orange")
		);

		/* Add the various message component rows. */
		const rows = this.buildToolbar(user, db, action);
		
		rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
		return response;
	}

	private formatFields(db: DatabaseImage): EmbedField[] {
		const fields: Omit<EmbedField, "inline">[] = [];

		if (db.options.width !== GenerationSizes[0].width || db.options.height !== GenerationSizes[0].height) fields.push({
			name: "Size", value: `${db.options.width}x${db.options.height}`
		});

		if (db.options.steps !== DefaultGenerationOptions.steps) fields.push({
			name: "Steps", value: `${db.options.steps!}`
		});

		if (db.prompt.negative && db.prompt.negative !== DefaultPrompt.negative) fields.push({
			name: "Negative", value: db.prompt.negative
		});

		if (db.options.cfg_scale !== DefaultGenerationOptions.cfg_scale) fields.push({
			name: "Guidance", value: `${db.options.cfg_scale}`
		});

		if (db.options.style) {
			const style: ImageStyle = ImageStyles.find(s => s.id === db.options.style)!;

			fields.push({
				name: "Style", value: `${style.name} ${style.emoji}`
			});
		}

		return fields.map(field => ({ ...field, inline: true }));
	}

	private buildRow(user: User, db: DatabaseImage, action: ImageGenerationType): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		/* How many images to display per row */
		const perRow: number = 4;

		/* How many rows to display */
		const rowCount: number = Math.ceil(db.results.length / perRow);
		
		for (let i = 0; i < rowCount; i++) {
			rows.push(new ActionRowBuilder());
		}

		db.results.forEach((image, index) => {
			const which: number = Math.ceil((index + 1) / perRow) - 1;
			const row = rows[which];

			row.addComponents(
				new ButtonBuilder()
					.setCustomId(`i:${action}:${user.id}:${db.id}:${index}`)
					.setLabel(`${action.charAt(0).toUpperCase()}${index + 1}`)
					.setStyle(image.reason === "CONTENT_FILTERED" ? ButtonStyle.Danger : ButtonStyle.Secondary)
					.setDisabled(image.reason === "CONTENT_FILTERED")
			);
		});

		return rows;
	}

	private buildToolbar(user: User, db: DatabaseImage, action: ImageGenerationType): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		
		if (action !== "upscale") {
			rows.push(...this.buildRow(user, db, "upscale"));
		}

		if (rows[0] && action === "generate") {
			rows[0].addComponents(new ButtonBuilder()
				.setEmoji("🔄")
				.setCustomId(`i:redo:${user.id}:${db.id}`)
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

		if (data.action === "upscale" || data.action === "redo") {
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

		/* The user wants to re-generate an image */
		if (data.action === "redo") {
			const response = this.startImageGeneration({
				interaction, image: null,
				
				prompt: image.prompt, user: interaction.user, action: "generate",

				guidance: image.options.cfg_scale!,
				sampler: image.options.sampler!, seed: image.options.seed ?? null,
				steps: image.options.steps!, count: image.options.number!, moderation: null, db, 
				
				size: {
					width: image.options.width!,
					height: image.options.height!,

					premium: false
				}
			});

			const type = await this.bot.db.users.type(db);
			
			const duration: number | null = (ImageGenerationCooldown as any)[type.type] ?? null;
			if (duration !== null) await handler.applyCooldown(interaction, db, duration);

			return response;

		/* The user wants to upscale an image */
		} else if (data.action === "upscale" && image !== null && data.resultIndex !== null) {
			/* ID of generation result of the given image, associated with this action */
			const result: ImageResult = image.results.find((_, index) => index === data.resultIndex)!;

			await interaction.deferReply().catch(() => {});
			const { url } = this.bot.image.url(image, result);

			/* Fetch the selected image, to upscale it. */
			const buffer = await Utils.fetchBuffer(url);
			if (buffer === null) return;

			const response = this.startImageGeneration({
				interaction, image: buffer,
				
				prompt: image.prompt, user: interaction.user, action: "upscale",

				guidance: image.options.cfg_scale!,
				sampler: image.options.sampler!, seed: image.options.seed ?? null,
				steps: image.options.steps!, count: image.options.number!, moderation: null, db, 
				
				size: {
					width: image.options.width!,
					height: image.options.height!,

					premium: false
				}
			});

			const type = await this.bot.db.users.type(db);
			
			const duration: number | null = (ImageGenerationCooldown as any)[type.type] ?? null;
			if (duration !== null) await handler.applyCooldown(interaction, db, duration);

			return response;

		/* The user wants to rate an upscaled image */
		} else if (data.action === "rate") {
			if (interaction.user.id !== db.user.id) return void await interaction.deferUpdate();

			/* The selected result to rate */
			const result: ImageResult = image.results.find((_, index) => index === data.resultIndex)!;

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
			interaction, guidance, sampler, seed, size, user, count, steps, db, moderation, prompt, action, image
		} = options;

		const prompts: ImageGenerationPrompt[] = [
			{
				text: prompt.prompt
			}
		];

		if (prompt.negative) prompts.push({
			text: prompt.negative,
			weight: -1
		});

		/* Image generation options */
		const body: ImageGenerationOptions = {
			body: {
				prompts, action: action ?? "generate",

				sampler, steps, number: count,
				cfg_scale: guidance, seed: seed ?? undefined,
				style: prompt.style ? prompt.style.id : undefined,

				height: size.height, width: size.width,
				image: image !== null ? image.toString() : undefined
			}
		};

		try {
			const partial: Response = await this.formatPartialResponse(user, db, options, moderation);
			await partial.send(interaction);

			/* Generate the image. */
			const result = await this.bot.image.generate(body);
			
			/* Whether the generated images are still usable */
			const usable: boolean = result.images.filter(i => i.finishReason !== "CONTENT_FILTERED").length > 0;

			if (!usable) return new ErrorResponse({
				interaction, command: this, emoji: "🔞",
				message: "All of the generated images were deemed as **not safe for work**"
			});

			/* Add the generated results to the database. */
			const image: DatabaseImage = await this.bot.db.users.updateImage(
				this.bot.image.toDatabase(prompt, body.body, result, new Date().toISOString(), action)
			);

			/* Upload the generated images to the storage bucket. */
			await this.bot.db.storage.uploadImageResults(image, result.images);

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db, "images");
			
			await this.bot.db.metrics.changeImageMetric({
				counts: { [count]: "+1" },
				steps: { [steps]: "+1" }
			});

			await this.bot.db.plan.expenseForImage(
				db, image
			);

			/* Generate the final message, showing the generated results. */
			const final: Response = await this.buildResultResponse(user, image, action, moderation);
			await final.send(interaction);

		} catch (error) {
			/* If the image generation was blocked by Stable Horde itself, show a notice to the user. */
			if (error instanceof ImageAPIError && error.filtered) {
				const result: ModerationResult = {
					blocked: true, flagged: true, source: "image"
				};

				await this.bot.moderation.sendImageModerationMessage({
					content: prompt.prompt, user: interaction.user, db, result, notice: "flagged by external filters"
				});

				return new ErrorResponse({
					interaction, command: this, emoji: null,
					message: "**Your image prompt was flagged as inappropriate.** *If you violate our **usage policies**, we may have to take moderative actions; otherwise you can ignore this notice*."
				});
			}


			return await this.bot.error.handle({
				title: "Failed to generate image", notice: "It seems like we encountered an error while trying to generate the images for you.", error
			});		
		}
	}

    public async run(interaction: ChatInputCommandInteraction, db: DatabaseInfo): CommandResponse {
		const canUsePremiumFeatures: boolean = await this.bot.db.users.canUsePremiumFeatures(db);
		const subscriptionType = await this.bot.db.users.type(db);
		
		/* How many images to generate */
		const count: number = 
			interaction.options.getInteger("count")
			?? this.bot.db.settings.get<number>(db.user, "image:count");

		/* How many steps to generate the images with */
		const steps: number =
			interaction.options.getInteger("steps")
			?? Math.min(this.bot.db.settings.get<number>(db.user, "image:steps"), MaxStepGenerationCount[subscriptionType.type]);

		/* To which scale the AI should follow the prompt; higher values mean that the AI will respect the prompt more */
		const guidance: number = Math.round(interaction.options.getNumber("guidance") ?? DefaultGenerationOptions.cfg_scale!);

		/* Random seed, to reproduce the generated images in the future */
		const sampler: ImageSampler = interaction.options.getString("sampler") ?? ImageSamplers[0];

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

		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);
		const negativePrompt: string | null = interaction.options.getString("negative");

		/* Random seed, to reproduce the generated images in the future */
		const seed: number | null = interaction.options.getInteger("seed") ?? null;

		/* Which style to apply additionally */
		const styleID: string | null = interaction.options.getString("style");
		
		const style: ImageStyle | null = styleID !== null
			? ImageStyles.find(f => f.id === styleID)! : null;

		const moderation: ModerationResult = await this.bot.moderation.checkImagePrompt({
			db, user: interaction.user, content: prompt
		});

		/* If the message was flagged, send a warning message. */
		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your image prompt"
        });

		return this.startImageGeneration({
			interaction, guidance, count, moderation, sampler, seed, size, steps, db,
			user: interaction.user,
			
			prompt: {
				prompt: prompt, negative: negativePrompt ?? undefined,
				style: style ?? undefined
			},
			
			action: "generate", image: null
		});
    }
}