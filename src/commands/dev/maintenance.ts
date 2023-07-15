import { SlashCommandBuilder } from "discord.js";

import { Bot, BotStatusType, BotStatusTypeColorMap, BotStatusTypeEmojiMap, BotStatusTypeTitleMap } from "../../bot/bot.js";
import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { Response } from "../../command/response.js";

export default class MaintenanceCommand extends Command {
    constructor(bot: Bot) {
		/* Which statuses to show */
		const show: BotStatusType[] = [ "maintenance", "operational", "partialOutage", "investigating", "monitoring" ];

        super(bot,
            new SlashCommandBuilder()
                .setName("maintenance")
                .setDescription("Change the maintenance mode of the bot")
				.addStringOption(builder => builder
					.setName("which")
					.setDescription("Which status to switch to")
					.setRequired(true)
					.addChoices(...show.map(type => ({
						name: `${BotStatusTypeTitleMap[type]} ${BotStatusTypeEmojiMap[type]}`,
						value: type
					}))))
				.addStringOption(builder => builder
					.setName("notice")
					.setDescription("Notice message to display")
					.setRequired(false)
				)
        , { restriction: [ "owner" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* New bot status to switch to */
		const type: BotStatusType = interaction.options.getString("which", true) as BotStatusType;

		/* Notice message to display */
		const notice: string | undefined = interaction.options.getString("notice") ?? undefined;
		
		/* Final status to switch to */
		await this.bot.changeStatus({
			type: type as BotStatusType, notice	
		});

		return new Response()
			.addEmbed(builder => builder
				.setTitle(`${BotStatusTypeTitleMap[type]} ${BotStatusTypeEmojiMap[type]}`)
				.setDescription(notice !== undefined ? `*${notice}*` : null)
				.setColor(BotStatusTypeColorMap[type])
			);
    }
}