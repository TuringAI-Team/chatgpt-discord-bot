import { ActionRow, ActionRowBuilder, AttachmentBuilder, ButtonBuilder, ButtonComponent, ButtonInteraction, ButtonStyle, EmbedBuilder, InteractionResponse, SlashCommandBuilder } from "discord.js";

import { MidjourneyAction, MidjourneyModelIdentifier, MidjourneyModels, MidjourneyPartialResult, MidjourneyResult } from "../turing/api.js";
import { ModerationResult, checkImagePrompt } from "../conversation/moderation/moderation.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { MAX_IMAGE_PROMPT_LENGTH, RATE_ACTIONS, RateAction } from "./imagine.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { Conversation } from "../conversation/conversation.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";
import { CooldownData } from "../command/cooldown.js";

export default class MidjourneyCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("mj")
			.setDescription("Generate beautiful images using Midjourney")
			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MAX_IMAGE_PROMPT_LENGTH)
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
				free: 30 * 1000,
				voter: 20 * 1000,
				subscription: 15 * 1000
			}
		});
	}

	private async build(interaction: CommandInteraction | ButtonInteraction, result: MidjourneyPartialResult | MidjourneyResult, db: DatabaseInfo): Promise<Response> {
		if (result.error && result.error.includes("too many images")) return new ErrorResponse({
			message: "**We are currently dealing with too much traffic**; *please try your request again later*."
		});

		if (result.error && result.error.includes("Flagged")) return new ErrorResponse({
			message: "**Your prompt was blocked by Midjourney's moderation filters**; *please try out a different prompt*."
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

		embed.setTitle(`**${Utils.truncate(result.prompt, 150)}** — @${interaction.user.username}${result.action ? ` ${result.action === "upscale" ? "🔎" : "🔄"}` : ""}`);

		if (!result.done) embed.setDescription(`${result.status !== null && result.status > 0 ? `${result.status * 100}%` : "Generating"} **...** ${loadingEmoji}`);

		if (result.image && result.id) {
			const buffer = await Utils.fetchBuffer(result.image);

			if (buffer) {
				response.addAttachment(new AttachmentBuilder(buffer.buffer).setName(`${result.id}.png`));
				embed.setImage(`attachment://${result.id}.png`);
			}
		}

		if (result.done) {
			const rows = this.buildToolbar(interaction, result as MidjourneyResult);
			rows.forEach(row => response.addComponent(ActionRowBuilder<ButtonBuilder>, row));
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
					.setLabel(`${type.at(0)!.toUpperCase()}${i + 1}`)
					.setCustomId(`mj:${type}:${interaction.user.id}:${result.id}:${i}`)
					.setStyle(ButtonStyle.Secondary)
			);
		}

		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(buttons);
	}

	private buildRatingRow(interaction: ButtonInteraction | CommandInteraction, result: MidjourneyResult): ActionRowBuilder<ButtonBuilder> {
		return new ActionRowBuilder<ButtonBuilder>()
			.addComponents(RATE_ACTIONS.map(action =>
				new ButtonBuilder()
					.setCustomId(`mj:rate:${interaction.user.id}:${result.jobId}:${result.number}:${action.value}`)
					.setStyle(ButtonStyle.Secondary)
					.setEmoji(action.emoji)
			));
	}

	private buildToolbar(interaction: ButtonInteraction | CommandInteraction, result: MidjourneyResult): ActionRowBuilder<ButtonBuilder>[] {
		const rows: ActionRowBuilder<ButtonBuilder>[] = [];

		if (result.action !== "upscale") {
			if (result.action !== "variation") rows.push(this.buildRow(interaction, result, "variation"));
			rows.push(this.buildRow(interaction, result, "upscale"));
		}

		if (result.action === "upscale") rows.push(this.buildRatingRow(interaction, result));
		return rows;
	}

	public async handleInteraction(interaction: ButtonInteraction): Promise<void> {
        /* Database instances, guild & user */
        const db: DatabaseInfo = await this.bot.db.users.fetchData(interaction.user, interaction.guild);

		const data: string[] = interaction.customId.split(":");
		data.shift();

		/* The action to perform */
		const action: MidjourneyAction | "rate" = data.shift()! as any;

		/* ID of the user this action is for */
		const userID: string = data.shift()! as any;

		/* ID of the original image result */
		const id: string = data.shift()!;

		/* Which image index to use */
		const index: number = parseInt(data.shift()!);

		if (action === "upscale" || action === "variation") {
			/* Get the current cool-down of the command. */
			const cooldown: CooldownData | null = await this.currentCooldown(interaction);
			
			/* If the user is currently on cool-down for this command, ... */
			if (cooldown !== null && cooldown.createdAt) {
				/* Build the cool-down message. */
				const response: Response = this.bot.command.cooldownMessage(interaction, this, db, cooldown);

				/* How long until the cool-down expires */
				const delay: number = (cooldown.createdAt + cooldown.duration) - Date.now() - 1000;

				/* Send the notice message. */
				return await response.send(interaction)
					.then(message => {
						if (message instanceof InteractionResponse) {
							/* Delete the cool-down message again, after it has expired. */
							setTimeout(async () => {
								await interaction.deleteReply().catch(() => {});
							}, delay);
						}
					});
			}

			await this.applyCooldown(interaction, db);

			/* All components on the original message */
			let components: ActionRow<ButtonComponent>[] = interaction.message.components as ActionRow<ButtonComponent>[];

			components.forEach(
				row => row.components.forEach(button => {
					if (button.customId === interaction.customId) {
						(button.data as any).style = ButtonStyle.Primary;
						(button.data as any).disabled = true;
					}
				})
			);

			/* Remove the variation row from the message. */
			if (action === "variation") components = [ components[1] ];

			await interaction.message.edit({
				embeds: [ EmbedBuilder.from(interaction.message.embeds[0]).setImage(`attachment://${id}.png`) ], components
			});

			await interaction.deferReply();

			/* Wait for the actual generation result. */
			const result: MidjourneyResult = await this.bot.turing.imagine({
				action, id, number: index,
				progress: result => this.progress(interaction, result, db)
			});

			await this.bot.db.metrics.changeMidjourneyMetric({ [action]: "+1" });
			await this.bot.db.plan.expenseForMidjourneyImage(db, result);

			const response = await this.build(interaction, result, db);
			await response.send(interaction);

		} else if (action === "rate") {
			if (interaction.user.id !== userID) return void await interaction.deferUpdate();

			/* Find the corresponding rating action. */
			const rating: RateAction = RATE_ACTIONS.find(r => r.emoji === interaction.component.emoji?.name)!;

			/* All components on the original message */
			const row: ActionRow<ButtonComponent> = interaction.message.components[0] as ActionRow<ButtonComponent>;

			row.components.forEach(button => {
				if (button.customId === interaction.customId) (button.data as any).style = ButtonStyle.Primary;
				(button.data as any).disabled = true;
			});

			await interaction.message.edit({
				embeds: [ EmbedBuilder.from(interaction.message.embeds[0]).setImage(`attachment://${id}.png`) ], components: [ row ]
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

			if (entry === null || error) await interaction.deferUpdate();

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
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* Which generation model to use; otherwise pick the default one */
		const model: MidjourneyModelIdentifier = interaction.options.getString("model") as MidjourneyModelIdentifier ?? "5";

		/* Which generation prompt to use as the input */
		const prompt: string = interaction.options.getString("prompt", true);

		const moderation: ModerationResult | null = await checkImagePrompt({
			conversation, db, content: prompt, nsfw: false, model: "midjourney"
		});

		/* If the message was flagged, send a warning message. */
		if (moderation !== null && moderation.blocked) return new ErrorResponse({
			interaction, command: this,
			message: "**Your image prompt was blocked by our filters.**\n\n*If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
			color: "Orange", emoji: null
		});

		await interaction.deferReply();

		/* Wait for the actual generation result. */
		const result: MidjourneyResult = await this.bot.turing.imagine({
			prompt, model, progress: result => this.progress(interaction, result, db)
		});

		await this.bot.db.metrics.changeMidjourneyMetric({ generation: "+1" });
		await this.bot.db.plan.expenseForMidjourneyImage(db, result);

		return await this.build(interaction, result, db);
    }
}