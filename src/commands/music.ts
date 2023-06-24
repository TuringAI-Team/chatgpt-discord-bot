import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";

import { TuringVideoModel, TuringVideoModels, TuringVideoOptions } from "../turing/api.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";
import { RunPodMusicGenInput } from "../runpod/models/musicgen.js";
import { LoadingResponse } from "../command/response/loading.js";
import { LoadingIndicator, LoadingIndicatorManager } from "../db/types/indicator.js";

const MAX_MUSIC_PROMPT_LENGTH: number = 200

export default class VideoCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("music")
			.setDescription("Generate music from a text prompt using AI")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MAX_MUSIC_PROMPT_LENGTH)
				.setRequired(true)
			)
		, {
			cooldown: {
				free: 4.5 * 60 * 100,
				voter: 4 * 60 * 100,
				subscription: 1.5 * 60 * 1000
			},

			restriction: [ "voter" ],
			synchronous: true
		});
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);

		if (prompt.length > MAX_MUSIC_PROMPT_LENGTH) return new ErrorResponse({
			interaction, command: this,
			message: `The specified prompt is **too long**, it can't be longer than **${MAX_MUSIC_PROMPT_LENGTH}** characters`
		});

		/* Defer the reply, as this might take a while. */
		await interaction.deferReply().catch(() => {});

		const moderation = await this.bot.moderation.check({
			db, user: interaction.user, content: prompt, source: "video"
		});

		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your video prompt"
        });

		/* Music generation options */
		const options: RunPodMusicGenInput = {
			descriptions: [
				prompt
			],
		};

		try {
			/* The user's loading indicator */
			const indicator: string = LoadingIndicatorManager.toString(
				LoadingIndicatorManager.getFromUser(this.bot, db.user)
			);

			/* Try to generate the actual results. */
			const result = await this.bot.runpod.musicGen(options, async data => {				
				await new Response()
					.addEmbed(builder => builder
						.setTitle(`${data.status === "IN_PROGRESS" ? "Generating" : "Queued"} **...** ${indicator}`)
						.setColor("Orange")
					)
				.send(interaction);
			});

			/* Increment the user's usage. */
			await this.bot.db.users.incrementInteractions(db, "songs");
			await this.bot.db.plan.expenseForMusic(db, result);

			const response: Response = new Response()
				.setContent(`**${prompt}** — *${(result.raw.duration / 1000).toFixed(1)} seconds*`);

			for (const buffer of result.results) {
				response.addAttachment(
					new AttachmentBuilder(buffer.buffer).setName(`${prompt}.mp3`)
				)
			}

			return response;
			
		} catch (error) {
			return await this.bot.error.handle({
				title: "Failed to generate music", notice: "It seems like we encountered an error while trying to generate the song for you.", error
			});
		}
    }
}