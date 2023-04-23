import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { StatusTypeColorMap, StatusTypeEmojiMap, StatusTypeTitleMap } from "../status.js";
import { Bot, BotStatusType } from "../../bot/bot.js";
import { Response } from "../../command/response.js";

export default class MaintenanceCommand extends Command {
    constructor(bot: Bot) {
		/* Which statuses to show */
		const show: BotStatusType[] = [ "maintenance", "operational", "partial_outage", "major_outage", "investigating", "monitoring" ];

        super(bot,
            new SlashCommandBuilder()
                .setName("maintenance")
                .setDescription("Change the maintenance mode of the bot")
				.addStringOption(builder => builder
					.setName("which")
					.setDescription("Which status to switch to")
					.setRequired(true)
					.addChoices(...show.map(type => ({
						name: `${StatusTypeTitleMap[type]} ${StatusTypeEmojiMap[type]}`,
						value: type
					}))))
				.addStringOption(builder => builder
					.setName("notice")
					.setDescription("Notice message to display")
					.setRequired(false)
				)
        , { private: CommandPrivateType.OwnerOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* New bot status to switch to */
		const type: string = interaction.options.getString("which", true);

		/* Notice message to display */
		const notice: string | undefined = interaction.options.getString("notice") ?? undefined;
		
		/* Final status to switch to */
		await this.bot.changeStatus({
			type: type as BotStatusType, notice	
		});

		return new Response()
			.addEmbed(builder => builder
				.setTitle(`${StatusTypeTitleMap[type]} ${StatusTypeEmojiMap[type]}`)
				.setDescription(notice !== undefined ? `*${notice}*` : null)
				.setColor(StatusTypeColorMap[type])
			);
    }
}