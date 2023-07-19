import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";
import { Image, createCanvas } from "@napi-rs/canvas";
import { readFile } from "fs/promises";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { RunPodMusicGenInput } from "../runpod/models/musicgen.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { ImageBuffer } from "../util/image.js";
import { Bot } from "../bot/bot.js";

const MaxMusicPromptLength: number = 200

interface MusicDurationSetting {
	/* Duration, in seconds */
	duration: number;

	/* Which "role" this duration is restricted to */
	restriction?: "premium" | "plan";
}

const MusicDurationSettings: MusicDurationSetting[] = [
	{ duration: 5 },
	{ duration: 10 },
	{ duration: 15 },
	{ duration: 30, restriction: "premium" },
	{ duration: 45, restriction: "premium" },
	{ duration: 60, restriction: "premium" },
	{ duration: 90, restriction: "plan" },
	{ duration: 120, restriction: "plan" }
]

/* Background image, to use for the generated video */
const BackgroundImage: Image = new Image();
BackgroundImage.src = await readFile("./assets/music/background.png");

export default class MusicCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("music")
			.setDescription("Generate music from a text prompt using AI")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("The possibilities are endless... 💫")
				.setMaxLength(MaxMusicPromptLength)
				.setRequired(true)
			)

			.addNumberOption(builder => builder
				.setName("duration")
				.setDescription("How long the music should be")
				.addChoices(...MusicDurationSettings.map(s => ({
					name: `${s.duration} seconds${s.restriction === "plan" ? " 📊" : s.restriction === "premium" ? " ✨" : ""}`,
					value: s.duration
				})))
			)
		, {
			cooldown: {
				free: 4.5 * 60 * 1000,
				voter: 4 * 60 * 1000,
				subscription: 1.5 * 60 * 1000
			},

			restriction: [ "voter" ],
			synchronous: true
		});
	}

	public async convert(audio: ImageBuffer, prompt: string, duration: MusicDurationSetting): Promise<ImageBuffer> {
		const canvas = createCanvas(BackgroundImage.width, BackgroundImage.height);
		const context = canvas.getContext("2d");

        /* Draw the original image first. */
        context.drawImage(BackgroundImage, 0, 0);

		context.textAlign = "center";
		context.lineWidth = 3;

		/* Current font size */
		let fontSize: number = 50;
	
		do {
			/* Assign the font to the context and decrement it so it can be measured again. */
			context.font = `${fontSize -= 1}px Calibri`;
		} while (context.measureText(prompt).width > canvas.width - 20);

		context.fillStyle = "#ffffff";
		context.strokeStyle = "#000000";
		
		const x: number = canvas.width / 2;
		const y: number = canvas.height / 2;

		context.strokeText(prompt, x, y);
		context.fillText(prompt, x, y);

		/* The source image for the video */
        const src = new ImageBuffer(await canvas.encode("png"));

		const video: ImageBuffer = await this.bot.turing.MP3toMP4({
			audio: audio.toString(), image: src.toString(), duration: duration.duration
		});

		return video;
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Which prompt to use for generation */
		const prompt: string = interaction.options.getString("prompt", true);

		if (prompt.length > MaxMusicPromptLength) return new ErrorResponse({
			interaction, command: this,
			message: `Your specified prompt is **too long**, it can't be longer than **${MaxMusicPromptLength}** characters`
		});

		/* Raw duration, specified in the command options */
		const rawDuration: number = interaction.options.getNumber("duration", false) ?? 15;
		const duration: MusicDurationSetting = MusicDurationSettings.find(d => d.duration === rawDuration)!;

        /* Subscription type of the user & guild */
        const subscriptionType = await this.bot.db.users.type(db);

		if (duration.restriction === "premium" && !subscriptionType.premium) {
			return new Response()
				.addEmbed(builder => builder
					.setDescription(`✨ This duration is restricted to **Premium** users.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
					.setColor("Orange")
				)
				.setEphemeral(true);
		}

		if (duration.restriction === "plan" && subscriptionType.type !== "plan") {
			return new Response()
				.addEmbed(builder => builder
					.setDescription(`✨ This duration is restricted to **pay-as-you-go Premium 📊** users.\n**Premium** *also includes further benefits, view \`/premium\` for differences between them & more*. ✨`)
					.setColor("Orange")
				)
				.setEphemeral(true);
		}

		/* Defer the reply, as this might take a while. */
		await interaction.deferReply().catch(() => {});

		const moderation = await this.bot.moderation.check({
			db, user: interaction.user, content: prompt, source: "music"
		});

		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your music prompt"
        });

		/* Music generation options */
		const options: RunPodMusicGenInput = {
			descriptions: [
				prompt
			],

			duration: duration.duration,
			modelName: "large"
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

			await new Response()
				.addEmbed(builder => builder
					.setTitle(`Converting **...** ${indicator}`)
					.setColor("Orange")
				)
			.send(interaction);

			const response: Response = new Response();

			for (const buffer of result.results) {
				const video: ImageBuffer = await this.convert(buffer, prompt, duration);

				response.addAttachment(
					new AttachmentBuilder(video.buffer).setName(`${prompt}.mp4`)
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