import { AttachmentBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { LoadingIndicatorManager } from "../db/types/indicator.js";
import { RunPodMusicGenInput } from "../runpod/models/musicgen.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

const MAX_MUSIC_PROMPT_LENGTH: number = 200

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
			db, user: interaction.user, content: prompt, source: "music"
		});

		if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "Your music prompt"
        });

		/* Raw duration, specified in the command options */
		const rawDuration: number = interaction.options.getNumber("duration", false) ?? 15;
		const duration: MusicDurationSetting = MusicDurationSettings.find(d => d.duration === rawDuration)!;

        /* Subscription type of the user & guild */
        const subscriptionType = await this.bot.db.users.type(db);

		if (duration.restriction === "premium" && !subscriptionType.premium) {
			return void await new Response()
				.addEmbed(builder => builder
					.setDescription(`✨ This duration is restricted to **Premium** users.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
					.setColor("Orange")
				)
				.setEphemeral(true)
			.send(interaction);
		}

		if (duration.restriction === "plan" && subscriptionType.type !== "plan") {
			return void await new Response()
				.addEmbed(builder => builder
					.setDescription(`✨ This duration is restricted to **pay-as-you-go Premium 📊** users.\n**Premium** *also includes further benefits, view \`/premium\` for differences between them & more*. ✨`)
					.setColor("Orange")
				)
				.setEphemeral(true)
			.send(interaction);
		}

		/* Music generation options */
		const options: RunPodMusicGenInput = {
			descriptions: [
				prompt
			],

			modelName: "large",
			duration: duration.duration
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