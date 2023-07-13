import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseError } from "../../moderation/error.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

export default class UserCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("error")
				.setDescription("View information about an occurred error")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID of the error to view")
					.setRequired(true)
				)
        , { restriction: [ "moderator" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the error */
		const id: string = interaction.options.getString("id", true);

		/* Get the database entry of the error. */
		const error: DatabaseError | null = await this.bot.db.users.getError(id);
		
		if (error === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified error doesn't exist 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* When the error occurred */
		const when: number = Date.parse(error.when);

		return new Response()
			.addEmbed(builder => builder
				.setTitle(`Error Overview for \`${error.id}\` ⚠️`)
				.setDescription(this.bot.error.formattedResponse(error))
				.setTimestamp(when)
				.setColor("Red")
			)
			.setEphemeral(true);
    }
}