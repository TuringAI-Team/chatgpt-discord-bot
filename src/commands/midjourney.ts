import { ActionRow, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, EmbedBuilder, InteractionResponse, SlashCommandBuilder } from "discord.js";

import { MidjourneyAction, MidjourneyModelIdentifier, MidjourneyModels, MidjourneyPartialResult, MidjourneyResult } from "../turing/api.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { MaxImagePromptLength, RateActions, RateAction } from "./imagine.js";
import { MidjourneyInteractionHandler } from "../interactions/midjourney.js";
import { InteractionHandlerResponse } from "../interaction/handler.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { NoticeResponse } from "../command/response/notice.js";
import { ErrorResponse } from "../command/response/error.js";
import { GPTDatabaseError } from "../error/gpt/db.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class MidjourneyCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("mj")
			.setDescription("Generate beautiful images using MJ")
			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MaxImagePromptLength)
				.setRequired(true)
			)
			.addStringOption(builder => builder
				.setName("model")
				.addChoices(...MidjourneyModels.map(model => ({
					name: model.name, value: model.id
				})))
				.setDescription("Which model to use")
				.setRequired(false)
			)
		, {
			cooldown: {
				free: 5 * 60 * 1000,
				voter: 4 * 50 * 1000,
				subscription: 2 * 60 * 1000
			},

			synchronous: true
		});
	}

	private async build(interaction: CommandInteraction | ButtonInteraction, result: MidjourneyPartialResult | MidjourneyResult, db: DatabaseInfo): Promise<Response> {
		if (result.error && result.error.includes("many images")) return new ErrorResponse({
			message: "**We are currently dealing with too much traffic**; *please try your request again later*."
		});

		if (result.error && result.error.includes("Flagged")) return new ErrorResponse({
			message: "**Your prompt was blocked by the moderation filters**; *please try out a different prompt*."
		});

		if (result.error) return new ErrorResponse({
			message: `**${result.error}**; *please try your request again later*.`
		});

		/* The user's loading indicator */
		const loadingEmoji: string = LoadingIndicatorManager.toString(
			LoadingIndicatorManager.getFromUser(this.bot, db.user)
		);

		const response: Response = new Response();

		const embed: EmbedBuilder = new EmbedBuilder()
			.setColor(result.done ? this.bot.branding.color : "Orange")
			.setFooter({ text: "We are not affiliated with Midjourney.", iconURL: "https://cdn.discordapp.com/avatars/936929561302675456/4a79ea7cd151474ff9f6e08339d69380.png" });

		embed.setTitle(`**${result.prompt ? Utils.truncate(result.prompt, 150): "..."}** — @${interaction.user.username}${result.action ? ` ${result.action === "upscale" ? "🔎" : "🔄"}` : ""}`);

		if (!result.done && !result.queued) embed.setDescription(`${result.status !== null && result.status > 0 ? `${Math.floor(result.status * 100)}%` : "Generating"} **...** ${loadingEmoji}`);
		else if (result.queued) embed.setDescription(`Waiting in position \`#${result.queued + 1}\` **...** ${loadingEmoji}`);

		if (result.image) {
			const buffer = await Utils.fetchBuffer(result.image);

			if (buffer) {
				response.addAttachment(new AttachmentBuilder(buffer.buffer).setName("output.png"));
				embed.setImage("attachment://output.png");
			}
		}

		if (result.done) {
			const rows = this.buildToolbar(interaction, result as MidjourneyResult);
			rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
		} else {
			const row = this.buildPendingRow(interaction, result);
			if (row !== null) response.addComponent(ActionRowBuilder<ButtonBuilder>, row);
		}

		return response.addEmbed(embed);
	}

	private async progress(interaction: CommandInteraction | ButtonInteraction, result: MidjourneyPartialResult, db: DatabaseInfo): Promise<void> {
		const response: Response = await this.build(interaction, result, db);
		await response.send(interaction);
	}

	private buildRow(interaction: CommandInteraction | ButtonInteraction, result: MidjourneyResult, type: MidjourneyAction): ActionRowBuilder<ButtonBuilder> {
		const buttons: ButtonBuilder[] = [];

		for (let i = 0; i < 4; i++) {
			buttons.push(
				new ButtonBuilder()
					.setLabel(`${type.charAt(0).toUpperCase()}${i + 1}`)
					.setCustomId(`mj:${type}:${interaction.user.id}:${result.id}:${i}`)
					.setStyle(ButtonStyle.Secondary)
			);
		}

		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(buttons);
	}

	private buildRatingRow(interaction: ButtonInteraction | CommandInteraction, result: MidjourneyResult): ActionRowBuilder<ButtonBuilder> {
		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(RateActions.map(action =>
				new ButtonBuilder()
					.setCustomId(`mj:rate:${interaction.user.id}:${result.jobId}:${result.number}:${action.value}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(action.emoji)
			));
	}

	private buildPendingRow(interaction: ButtonInteraction | CommandInteraction, result: MidjourneyPartialResult): ActionRowBuilder<ButtonBuilder> | null {
		const row = new ActionRowBuilder<ButtonBuilder>();

		if (result.image) row
			.addComponents(
				new ButtonBuilder()
					.setCustomId(`mj:cancel:${interaction.user.id}:${result.id}`)
					.setStyle(ButtonStyle.Danger)
					.setLabel("Cancel")
					.setEmoji("🗑️")
			);

		return row.components.length > 0 ? row : null;
	}

	private buildToolbar(interaction: ButtonInteraction | CommandInteraction, result: MidjourneyResult): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		if (result.action !== "upscale") {
			rows.push(this.buildRow(interaction, result, "upscale"));
			if (result.action !== "variation") rows.push(this.buildRow(interaction, result, "variation"));
		}

		if (result.action === "upscale") rows.push(this.buildRatingRow(interaction, result));
		return rows;
	}

	private buildCancelResponse(): Response {
		return new NoticeResponse({
			color: "Red", message: "Cancelled ❌"
		});
	}

	public async handleInteraction(handler: MidjourneyInteractionHandler, interaction: ButtonInteraction, db: DatabaseInfo, data: string[]): InteractionHandlerResponse {
		/* The action to perform */
		const action: MidjourneyAction | "rate" | "cancel" = data.shift()! as any;

		/* ID of the user this action is for */
		const userID: string = data.shift()! as any;

		/* ID of the original image result */
		const id: string = data.shift()!;

		/* Which image index to use */
		const index: number = parseInt(data.shift()!);

		if (action === "upscale" || action === "variation") {
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
				embeds: [ EmbedBuilder.from(interaction.message.embeds[0]).setImage("attachment://output.png") ], components
			});

			await interaction.deferReply();

			try {
				/* Wait for the actual generation result. */
				const result: MidjourneyResult = await this.bot.turing.imagine({
					action, id, number: index, db,
					progress: result => this.progress(interaction, result, db)
				});

				await this.bot.db.metrics.changeMidjourneyMetric({ [action]: "+1", credits: `+${result.credits}` });
				await this.bot.db.plan.expenseForMidjourneyImage(db, result);
				await this.bot.db.users.incrementInteractions(db, "images");

				if (!this.bot.db.users.canUsePremiumFeatures(db)) {
					await handler.applyCooldown(interaction, db, action === "upscale" ? 30 * 1000 : 60 * 1000);
				}

				return await this.build(interaction, result, db);

			} catch (error) {
				if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Cancelled) {
					return this.buildCancelResponse();
				}
	
				throw error;
			}

		} else if (action === "cancel") {
			if (interaction.user.id !== userID) return void await interaction.deferUpdate();
			await this.bot.turing.cancelImagineRequest(id);
			
		} else if (action === "rate") {
			if (interaction.user.id !== userID) return void await interaction.deferUpdate();

			/* Find the corresponding rating action. */
			const rating: RateAction = RateActions.find(r => r.emoji === interaction.component.emoji?.name)!;

			/* All components on the original message */
			const row: ActionRow<ButtonComponent> = interaction.message.components[0] as ActionRow<ButtonComponent>;

			row.components.forEach(button => {
				if (button.customId === interaction.customId) (button.data as any).style = ButtonStyle.Primary;
				(button.data as any).disabled = true;
			});

			await interaction.message.edit({
				embeds: [ EmbedBuilder.from(interaction.message.embeds[0]).setImage("attachment://output.png") ], components: [ row ]
			});

			await interaction.deferUpdate();

			await this.bot.db.metrics.changeMidjourneyMetric({
				rate: {
					[rating.value]: "+1"
				}
			});

			/* Get the existing dataset entry. */
			const { data: entry, error } = await this.bot.db.client
				.from("dataset")
				.select("*").eq("id", id)
				.single();

			if (entry === null || error) throw new GPTDatabaseError({
				collection: "dataset" as any, raw: error
			});

			/* Updated dataset entry */
			const updated = {
				...entry.data, rating: rating.value
			};

			await this.bot.db.client
				.from("dataset")
				.update({
					data: updated
				})
				.eq("id", id).select("*");
		}
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Which generation model to use; otherwise pick the default one */
		const model: MidjourneyModelIdentifier = interaction.options.getString("model") as MidjourneyModelIdentifier ?? "5.1";

		/* Which generation prompt to use as the input */
		const prompt: string = interaction.options.getString("prompt", true);

		await interaction.deferReply();

		const moderation = await this.bot.moderation.checkImagePrompt({
			db, user: interaction.user, content: prompt, nsfw: false, model: "midjourney"
		});

		/* If the message was flagged, send a warning message. */
		if (moderation !== null && moderation.blocked) return new ErrorResponse({
			interaction, command: this,
			message: "**Your image prompt was blocked by our filters.**\n\n*If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
			color: "Orange", emoji: null
		});

		try {
			/* Wait for the actual generation result. */
			const result: MidjourneyResult = await this.bot.turing.imagine({
				prompt, model, db, progress: result => this.progress(interaction, result, db)
			});

			await this.bot.db.metrics.changeMidjourneyMetric({ generation: "+1", credits: `+${result.credits}` });
			await this.bot.db.plan.expenseForMidjourneyImage(db, result);
			await this.bot.db.users.incrementInteractions(db, "images");

			return await this.build(interaction, result, db);

		} catch (error) {
			if (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.Cancelled) {
				return this.buildCancelResponse();
			}

			throw error;
		}
    }
}