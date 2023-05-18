import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";

import { ModerationResult, checkImagePrompt } from "../conversation/moderation/moderation.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { Conversation } from "../conversation/conversation.js";
import { handleError } from "../util/moderation/error.js";
import { MAX_IMAGE_PROMPT_LENGTH } from "./imagine.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { TuringImageOptions } from "../turing/api.js";
import { Response } from "../command/response.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";

export default class DallECommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("dall-e")
			.setDescription("Generate images using DALL·E 2 by OpenAI")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MAX_IMAGE_PROMPT_LENGTH)
				.setRequired(true)
			)

			.addIntegerOption(builder => builder
				.setName("count")
				.setDescription("How many images to generate")
				.setMinValue(1)
				.setMaxValue(2)
				.setRequired(false)
			)
		, {
			cooldown: {
				free: 5 * 60 * 1000,
				voter: 4 * 60 * 1000,
				subscription: 1 * 60 * 1000
			}
		});
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);

		if (prompt.length > MAX_IMAGE_PROMPT_LENGTH) return new ErrorResponse({
			interaction, command: this,
			message: `The specified prompt is **too long**, it can't be longer than **${MAX_IMAGE_PROMPT_LENGTH}** characters`,
		});

		/* How many images to generate */
		const count: number = interaction.options.getInteger("count") ?? 1;

		/* Defer the reply, as this might take a while. */
		await interaction.deferReply().catch(() => {});

		const moderation: ModerationResult | null = await checkImagePrompt({
			conversation, db, content: prompt, nsfw: false
		});

		/* If the message was flagged, send a warning message. */
		if (moderation !== null && moderation.blocked) return new ErrorResponse({
			interaction, command: this,
			message: "Your image prompt was blocked by our filters. *If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
			color: "Orange", emoji: null
		});

		/* Video generation options */
		const options: TuringImageOptions = {
			prompt, count
		};

		try {
			/* Try to generate the DALL-E images. */
			const result = await conversation.manager.bot.turing.generateImages(options);

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db.user, "images");

			await this.bot.db.metrics.changeImageMetric({
				models: {
					"dall-e": "+1"
				},

				counts: {
					[count]: "+1"
				}
			});

			await this.bot.db.plan.expenseForDallEImage(db, count);

			const response =  new Response()
				.setContent(`**${prompt}** — *${(result.duration / 1000).toFixed(1)} seconds*`);

			result.images.forEach((image, index) => response.addAttachment(
				new AttachmentBuilder(image.buffer).setName(`result-${index}.png`)
			));

			return response;
			
		} catch (error) {
			if (error instanceof GPTAPIError && error.options.data.code === 400) return new ErrorResponse({
				interaction, command: this,
				message: "Your image prompt was blocked by **OpenAI**'s filters. *Make sure to follow the [usage policies](https://openai.com/policies/usage-policies); otherwise we may have to take moderative actions*.",
				color: "Orange", emoji: null
			});

			await handleError(this.bot, {
				title: "Failed to generate DALL·E images", 
				error: error as Error,
				reply: false
			});

			return new ErrorResponse({
				interaction, command: this, type: ErrorType.Error,
				message: "It seems like we encountered an error while trying to generate DALL·E images for you."
			});
		}
    }
}