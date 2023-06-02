import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";

import { TuringVideoModel, TuringVideoModels, TuringVideoOptions } from "../turing/api.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { ErrorResponse, ErrorType } from "../command/response/error.js";
import { Conversation } from "../conversation/conversation.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

const MAX_VIDEO_PROMPT_LENGTH: number = 200

export default class VideoCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("video")
			.setDescription("Generate a video from a text prompt using AI")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MAX_VIDEO_PROMPT_LENGTH)
				.setRequired(true)
			)

			.addStringOption(builder => builder
				.setName("model")
				.setDescription("Which video generation model to use")
				.addChoices(...TuringVideoModels.map(m => ({
					name: m.name,
					value: m.id
				})))
				.setRequired(false)
			)
		, {
			cooldown: {
				free: 5 * 60 * 100,
				voter: 5 * 60 * 100,
				subscription: 5 * 60 * 1000
			},

			restriction: [ "plan" ],
			synchronous: true
		});
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);

		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);

		if (prompt.length > MAX_VIDEO_PROMPT_LENGTH) return new ErrorResponse({
			interaction, command: this,
			message: `The specified prompt is **too long**, it can't be longer than **${MAX_VIDEO_PROMPT_LENGTH}** characters`
		});

		/* Which generation model to use; otherwise pick the default one */
		const modelName: string = interaction.options.getString("model") ?? this.bot.db.settings.get<string>(db.user, "video:model");

		/* Try to get the video generation model. */
		const model: TuringVideoModel | null = TuringVideoModels.find(m => m.id === modelName) ?? null;

		if (model === null) return new ErrorResponse({
			interaction, command: this,
			message: "You specified an invalid video generation model"
		});

		/* Defer the reply, as this might take a while. */
		await interaction.deferReply().catch(() => {});

		const moderation = await this.bot.moderation.check({
			db, user: interaction.user, content: prompt, source: "video"
		});

		if (moderation.blocked) return new ErrorResponse({
			interaction, command: this,
			message: "Your video prompt was blocked by our filters. *If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.",
			color: "Orange", emoji: null
		});

		/* Video generation options */
		const options: TuringVideoOptions = {
			prompt, model
		};

		try {
			/* Try to generate the actual video. */
			const result = await this.bot.turing.generateVideo(options);

			/* Fetch the actual video file. */
			const buffer: ImageBuffer | null = await Utils.fetchBuffer(result.url);
			if (buffer === null) throw new Error("Video buffer is null");

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db, "videos");
			await this.bot.db.plan.expenseForVideo(db, result, model);

			return new Response()
				.setContent(`**${prompt}** — using \`${model.name}\` — *${(result.duration / 1000).toFixed(1)} seconds*`)
				.addAttachment(
					new AttachmentBuilder(buffer.buffer).setName("output.mp4")
				);
			
		} catch (error) {
			await this.bot.moderation.error({
				title: "Failed to generate video", error
			});

			return new ErrorResponse({
				interaction, command: this, type: ErrorType.Error,
				message: "It seems like we encountered an error while trying to generate the video for you."
			});
		}
    }
}