import { ActionRow, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, EmbedField, SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";

import { DatabaseImage, ImageGenerationBody, ImageGenerationOptions, ImageGenerationType, ImagePartialGenerationResult, ImageResult } from "../image/types/image.js";
import { ImagineInteractionHandler, ImagineInteractionHandlerData } from "../interactions/imagine.js";
import { ImagePrompt, ImagePromptEnhancer, ImagePromptEnhancers } from "../image/types/prompt.js";
import { PremiumUpsellResponse, PremiumUpsellType } from "../command/response/premium.js";
import { ImageSampler, ImageSamplers } from "../image/types/sampler.js";
import { InteractionHandlerResponse } from "../interaction/handler.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { ImageStyle, ImageStyles } from "../image/types/style.js";
import { LoadingResponse } from "../command/response/loading.js";
import { CommandSpecificCooldown } from "../command/command.js";
import { renderIntoSingleImage } from "../image/utils/merge.js";
import { ModerationResult } from "../moderation/moderation.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { ImageBuffer } from "../chat/types/image.js";
import { ImageModel } from "../image/types/model.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

interface ImageGenerationProcessOptions {
	interaction: CommandInteraction | ButtonInteraction;
	user: User;
	guidance: number;
	sampler: ImageSampler;
	seed: number | null;
	ratio: ImageGenerationRatio | string;
	model: ImageModel | null;
	enhancer: ImagePromptEnhancer | null;
	steps: number;
	count: number;
	moderation: ModerationResult | null;
	db: DatabaseInfo;
	prompt: ImagePrompt;
	action: ImageGenerationType;
	image: ImageBuffer | null;
}

/* How long an image prompt can be, maximum */
export const MaxImagePromptLength: number = 200

export interface ImageGenerationRatio {
	a: number;
	b: number;
}

export interface ImageGenerationSize {
	width: number;
	height: number;
}

const DefaultGenerationOptions: Omit<Partial<ImageGenerationBody>, "prompts" | "action"> = {
	steps: 40, cfg_scale: 10, number: 2
}

const DefaultPrompt: Partial<ImagePrompt> = {
	negative: "cropped, artifacts, lowres, cropped, artifacts, lowres, lowres, bad anatomy, bad hands, error, missing fingers, extra digit, fewer digits, awkward fingers, cropped, jpeg artifacts, worst quality, low quality, signature, blurry, extra ears, deformed, disfigured, mutation, extra limbs"
}

const MaxStepGenerationCount = {
	free: 50,
	voter: 50,
	subscription: 100,
	plan: 100
}

export const ImageGenerationCooldown: CommandSpecificCooldown = {
	free: 4 * 60 * 1000,
	voter: 3.5 * 60 * 1000,
	subscription: 60 * 1000
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
				.setName("model")
				.setDescription("Which model to use")
				.addChoices(...this.bot.image.model.all().map(model => ({
					name: `${model.name} • ${model.description}`, value: model.id
				})))
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("style")
				.setDescription("Which style to use")
				.addChoices(
					...ImageStyles.map(style => ({
						name: `${style.emoji} ${style.name}`, value: style.id
					})),

					{
						name: "❌ None",
						value: "none"
					}
				)
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
				.setMinValue(15)
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
				.setMaxValue(99999999)
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("ratio")
				.setDescription("Which aspect ratio the images should have, e.g 16:9 or 1.5:1")
				.setRequired(false)
			)
			.addStringOption(builder => builder
				.setName("enhance")
				.setDescription("How to enhance your given prompt; if applicable")
				.setRequired(false)
				.addChoices(...ImagePromptEnhancers.map(({ name, emoji, id }) => ({
					name: `${emoji} ${name}`, value: id
				})))	
			);
    }

	private displayPrompt(user: User, prompt: ImagePrompt, action: ImageGenerationType | null): string {
		return `**${this.bot.image.prompt(prompt, 150)}** — @${user.username}${action !== null ? ` ${action === "upscale" ? "🔎" : ""}` : ""}`;
	}

	private async buildPartialResponse(user: User, db: DatabaseInfo, data: ImagePartialGenerationResult, options: ImageGenerationProcessOptions, moderation: ModerationResult | null): Promise<Response> {
		const loadingIndicator = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(this.bot, db.user)
		);

		const response = new Response()
			.addEmbed(builder => builder
				.setTitle(this.displayPrompt(user, options.prompt, options.action))
				.setDescription(`**${data.progress !== null && data.progress <= 1 ? `${Math.floor(data.progress * 100)}%` : Utils.titleCase(data.status)}** ... ${loadingIndicator}`)
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

		if (db.results.some(i => i.status === "filtered")) response.addEmbed(builder => builder
			.setDescription(`Some of the generated images were deemed as **not safe for work**.`)
			.setColor("Orange")
		);

		if (db.results.some(i => i.status === "failed")) response.addEmbed(builder => builder
			.setDescription(`Some of the requested images **failed** to generate.`)
			.setColor("Red")
		);

		/* Add the various message component rows. */
		const rows = this.buildToolbar(user, db, action);
		
		rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
		return response;
	}

	private formatFields(db: DatabaseImage): EmbedField[] {
		const fields: Omit<EmbedField, "inline">[] = [];

		const model: ImageModel = this.bot.image.model.get(db.model);
		fields.push({ name: "Model", value: model.name });

		if (db.options.ratio.a !== 1 || db.options.ratio.b !== 1) {
			const { width, height } = this.bot.image.findBestSize(db.options.ratio);
			fields.push({ name: "Ratio", value: `\`${db.options.ratio.a}:${db.options.ratio.b}\` (**${width}**x**${height}**)` });
		}

		if (db.options.steps !== DefaultGenerationOptions.steps) fields.push({
			name: "Steps", value: `${db.options.steps!}`
		});

		if (db.prompt.negative && db.prompt.negative !== DefaultPrompt.negative) fields.push({
			name: "Negative", value: `\`${db.prompt.negative}\``
		});

		if (db.options.cfg_scale !== DefaultGenerationOptions.cfg_scale) fields.push({
			name: "Guidance", value: `${db.options.cfg_scale}`
		});

		if (db.options.style) {
			const style: ImageStyle = ImageStyles.find(s => s.id === db.options.style)!;
			fields.push({ name: "Style", value: `${style.name} ${style.emoji}` });
		}

		if (db.prompt.mode && db.prompt.mode !== "none") {
			const enhancer: ImagePromptEnhancer = ImagePromptEnhancers.find(e => e.id === db.prompt.mode)!;
		
			fields.push(
				{ name: "Prompt enhancer", value: `${enhancer.name} ${enhancer.emoji}` },
				{ name: "Original prompt", value: `\`${db.prompt.original}\`` }
			);
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
					.setStyle(image.status === "success" ? ButtonStyle.Secondary : ButtonStyle.Danger)
					.setDisabled(image.status !== "success")
			);
		});

		return rows;
	}

	private buildToolbar(user: User, db: DatabaseImage, action: ImageGenerationType): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];
		
		if (action !== "upscale") {
			rows.push(...this.buildRow(user, db, "upscale"));
		} else {
			rows.push(this.bot.turing.dataset.buildRateToolbar({
				dataset: "image", id: db.id
			}));
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
			await interaction.deferReply().catch(() => {});

			const response = this.start({
				interaction, image: null, enhancer: null,
				prompt: image.prompt, user: interaction.user, action: "generate",

				guidance: image.options.cfg_scale!,
				sampler: image.options.sampler!, seed: image.options.seed ?? null,
				steps: image.options.steps!, count: image.options.number!, moderation: null, db,
				ratio: image.options.ratio!, model: this.bot.image.model.get(image.model)
			});

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

			const response = this.start({
				interaction, user: interaction.user, enhancer: null,
				prompt: image.prompt, action: "upscale",

				guidance: image.options.cfg_scale!,
				sampler: image.options.sampler!, seed: image.options.seed ?? null,
				steps: image.options.steps!, count: image.options.number!, moderation: null, db, 
				ratio: image.options.ratio!, image: buffer, model: null
			});			

			return response;

		} else {
			await interaction.deferUpdate();
		}
	}

	public async start(options: ImageGenerationProcessOptions): CommandResponse {
		const {
			interaction, guidance, sampler, seed, ratio: rawRatio, user, count, steps, db, moderation, action, image: source, model, enhancer
		} = options;

		/* The user's image prompt */
		let prompt: ImagePrompt = options.prompt;

		const handler = async (data: ImagePartialGenerationResult) => {
			if (data.progress === null) return;

			const partial: Response = await this.buildPartialResponse(user, db, data, { ...options, prompt }, moderation);
			await partial.send(interaction);
		};

		/* Parse & validate the given aspect ratio. */
		const ratio: ImageGenerationRatio | null = typeof rawRatio === "object"
			? rawRatio : this.bot.image.validRatio(rawRatio);

		if (ratio === null) return new ErrorResponse({
			interaction, command: this, message: "You specified an **invalid** aspect ratio"
		});

		/* Find the best size for the specified aspect ratio. */
		const { width, height } = this.bot.image.findBestSize(ratio);

		if (enhancer !== null && enhancer.id !== "none") {
			await new LoadingResponse({
				bot: this.bot, db, generic: false, phrases: "Enhancing your prompt"
			}).send(interaction);

			/* Try to enhance the user's prompt. */
			try {
				const enhanced: ImagePrompt = await this.bot.image.enhance(prompt, enhancer);
				if (enhanced.prompt !== prompt.prompt) prompt = enhanced;

			} catch (error) {
                await this.bot.error.handle({
                    title: "Failed to enhance a prompt", error
                });

				await new LoadingResponse({
					bot: this.bot, db, generic: false, color: "Orange", phrases: "Something went wrong while trying to enhance your prompt, continuing"
				}).send(interaction);
			}
		}

		/* The image generation style to apply additionally */
		const style: ImageStyle | null = prompt.style ?
			ImageStyles.find(f => f.id === prompt.style) ?? null
			: null;

		/* The formatted prompt, to pass to the API */
		let formattedPrompt: string = `${prompt.prompt}`;

		if (style !== null) formattedPrompt += `, ${style.tags.join(", ")}`;
		if (model !== null && model.tags.length > 0) formattedPrompt += `, ${model.tags.join(", ")}`;

		/* Image generation options */
		const body: ImageGenerationOptions = {
			body: {
				prompt: formattedPrompt,
				negative_prompt: prompt.negative ? prompt.negative : undefined,

				sampler, steps, number: count,
				cfg_scale: guidance, seed: seed ?? undefined,
				style: prompt.style ?? undefined,

				width, height, ratio
			},

			model: model ?? this.bot.image.model.default(),
			progress: handler
		};

		try {
			/* Generate the image. */
			const result = action == "upscale" && source
				? await this.bot.image.upscale({ image: source, prompt: prompt.prompt })
				: await this.bot.image.generate(body);
			
			/* Whether the generated images are still usable */
			const usable: boolean = result.results.filter(i => i.status === "success").length > 0;
			const failed: boolean = result.status === "failed";

			if (failed) return new ErrorResponse({
				interaction, command: this, message: `**${result.error ?? "The images failed to generate"}**; *please try your request again later*.`
			});

			if (!usable) return new ErrorResponse({
				interaction, command: this, message: "All of the generated images were deemed as **not safe for work**"
			});

			/* Add the generated results to the database. */
			const image: DatabaseImage = await this.bot.db.users.updateImage(
				this.bot.image.toDatabase(prompt, body, result, new Date().toISOString(), action)
			);

			/* Upload the generated images to the storage bucket. */
			await this.bot.db.storage.uploadImageResults(image, result.results);

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db, "images");
			await this.bot.db.plan.expenseForImage(db, image);
			
			await this.bot.db.metrics.changeImageMetric({
				models: { [(model ?? this.bot.image.model.default()).id]: "+1" },
				styles: { [style !== null ? style.id : "none"]: "+1" },
				ratios: { [`${ratio.a}:${ratio.b}`]: "+1" },
				samplers: { [sampler]: "+1" },
				counts: { [count]: "+1" },
				steps: { [steps]: "+1" }
			});

			/* Generate the final message, showing the generated results. */
			const final: Response = await this.buildResultResponse(user, image, action, moderation);
			await final.send(interaction);

		} catch (error) {
			return await this.bot.error.handle({
				title: "Failed to generate images", notice: "It seems like we encountered an error while generating the images for you.", error
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
		const steps: number = Math.min(
			interaction.options.getInteger("steps") ?? DefaultGenerationOptions.steps!,
			MaxStepGenerationCount[subscriptionType.type]
		);

		/* To which scale the AI should follow the prompt; higher values mean that the AI will respect the prompt more */
		const guidance: number = Math.round(interaction.options.getNumber("guidance") ?? DefaultGenerationOptions.cfg_scale!);

		/* Random seed, to reproduce the generated images in the future */
		const sampler: ImageSampler = interaction.options.getString("sampler") ?? ImageSamplers[0];

		/* If the user is trying to generate an image with more steps than possible for a normal user, send them a notice. */
		if (steps > MaxStepGenerationCount[subscriptionType.type]) return new PremiumUpsellResponse({
			type: PremiumUpsellType.ImagineSteps
		});

		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);
		const negativePrompt: string | null = interaction.options.getString("negative");

		/* Random seed, to reproduce the generated images in the future */
		const seed: number | null = interaction.options.getInteger("seed") ?? null;

		/* Which model to use */
		const modelID: string | null = interaction.options.getString("model", false) ?? this.bot.db.settings.get(db.user, "image:model");
		const model: ImageModel = modelID !== null ? this.bot.image.model.get(modelID) : this.bot.image.model.random();

		/* Ratio that the images should be */
		const ratio: string = interaction.options.getString("ratio") && model.settings.modifyResolution
			? interaction.options.getString("ratio", true) : "1:1";

		/* Which style to apply additionally */
		const styleID: string | null = interaction.options.getString("style", false) ?? this.bot.db.settings.get(db.user, "image:style");
		const style: ImageStyle | null = styleID !== null && styleID !== "none" ? ImageStyles.find(f => f.id === styleID)! : null;

		const enhancerID: string = interaction.options.getString("enhance", false) ?? this.bot.db.settings.get(db.user, "image:enhancer");
		const enhancer: ImagePromptEnhancer = ImagePromptEnhancers.find(e => e.id === enhancerID)!;

		await interaction.deferReply().catch(() => {});

		const moderation: ModerationResult = await this.bot.moderation.checkImagePrompt({
			db, user: interaction.user, content: prompt, model: model.id
		});

		/* If the message was flagged, send a warning message. */
		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your image prompt"
        });

		return this.start({
			interaction, guidance, count, moderation, sampler, seed, ratio, steps, db, model, enhancer,
			user: interaction.user,
			
			prompt: {
				prompt: prompt, negative: negativePrompt ?? undefined,
				style: style ? style.id : undefined
			},
			
			action: "generate", image: null
		});
    }
}