import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { ErrorResponse } from "../../command/response/error.js";
import { Bot } from "../../bot/bot.js";
import { NoticeResponse } from "../../command/response/notice.js";
import { Response } from "../../command/response.js";

export default class MetricsCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("metrics")
			.setDescription("View information about metrics")
			.addSubcommand(builder => builder
				.setName("save")
				.setDescription("Save all pending metrics to the database")
			)
			.addSubcommand(builder => builder
				.setName("view")
				.setDescription("View all pending metrics")
			)
		, { private: CommandPrivateType.OwnerOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		if (!this.bot.app.config.metrics) return new ErrorResponse({
			interaction, command: this, message: "Metrics are currently disabled"
		});

		/* Action to execute */
		const action: "save" | "view" = interaction.options.getSubcommand(true) as any;

		/* Save all pending metrics to the database */
		if (action === "save") {
			await this.bot.db.metrics.save();

			return new NoticeResponse({
				message: "Done 🙏", color: "Orange"
			});

		/* View all pending metrics */
		} else if (action === "view") {
			/* Pending metric entries */
			const pending = await this.bot.db.metrics.pending();

			if (pending.length === 0) return new ErrorResponse({
				interaction, command: this, message: "There are no pending metrics"
			});

			const embed: EmbedBuilder = new EmbedBuilder()
				.setTitle("Metrics ⚙️")
				.setColor(this.bot.branding.color);

			pending.forEach(m => embed.addFields({
				name: `\`${m.type}\``,
				value: `\`\`\`json\n${JSON.stringify(m.data, undefined, 4)}\n\`\`\``
			}));

			return new Response()
				.addEmbed(embed);
		}
    }
}