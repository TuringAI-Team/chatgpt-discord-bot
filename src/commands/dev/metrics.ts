import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { NoticeResponse } from "../../command/response/notice.js";
import { ErrorResponse } from "../../command/response/error.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

export const TIME_FRAME_OPTIONS = [
	dayjs.duration({ hours: 1 }),
	dayjs.duration({ days: 1 }),
	dayjs.duration({ weeks: 1 }),
	dayjs.duration({ weeks: 2 }),
	dayjs.duration({ months: 1 })
]

export default class MetricsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("metrics")
			.setDescription("View information about metrics")
			.addSubcommand(builder => builder
				.setName("save")
				.setDescription("Save all pending metrics to the database")
			)
			.addSubcommandGroup(builder => builder
				.setName("view")
				.setDescription("View all pending metrics")
				.addSubcommand(builder => builder
					.setName("raw")
					.setDescription("View all pending metrics in raw JSON")
				)
				.addSubcommand(builder => builder
					.setName("charts")
					.setDescription("View all pending metrics in charts")
					.addNumberOption(builder => builder
						.setName("time")
						.setDescription("Which time frame to view the charts in")
						.addChoices(...TIME_FRAME_OPTIONS.map(t => ({
							name: t.humanize(),
							value: t.asSeconds()
						})))
					)
				)
			)
		, { private: CommandPrivateType.OwnerOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		if (!this.bot.app.config.metrics) return new ErrorResponse({
			interaction, command: this, message: "Metrics are disabled"
		});

		/* Action to execute */
		const action: "save" | "view" = interaction.options.getSubcommandGroup(false) ?? interaction.options.getSubcommand(true) as any;

		/* Save all pending metrics to the database */
		if (action === "save") {
			await this.bot.db.metrics.save();

			return new NoticeResponse({
				message: "Done 🙏", color: "Orange"
			});

		/* View all pending metrics */
		} else if (action === "view") {
			/* How to display the metrics */
			const type: "chart" | "raw" = interaction.options.getSubcommand(true) as any;

			/* Pending metric entries */
			const lastResetAt = await this.bot.db.metrics.lastResetAt();
			const pending = await this.bot.db.metrics.pending();

			if (pending.length === 0) return new ErrorResponse({
				interaction, command: this, message: "There are no pending metrics"
			});

			if (type === "raw") {
				const embed: EmbedBuilder = new EmbedBuilder()
					.setTitle("Metrics ⚙️")
					.setColor(this.bot.branding.color);

				if (lastResetAt) embed.setTimestamp(lastResetAt);

				pending.forEach(m => embed.addFields({
					name: `\`${m.type}\``,
					value: `\`\`\`json\n${JSON.stringify(m.data, undefined, 4)}\n\`\`\``
				}));

				return new Response().addEmbed(embed);

			} else {
				return new ErrorResponse({
					interaction, command: this, message: "To be done", emoji: "🫡"
				});
			}
		}
    }
}