import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseUser } from "../../db/schemas/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class UserCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("user")
				.setDescription("View information about a user")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to view")
					.setRequired(true)
				)
        , { restriction: [ "moderator" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target = await Utils.findUser(this.bot, id);
		
		if (target === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user does not exist 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Get the database entry of the user, if applicable. */
		const db: DatabaseUser | null = await this.bot.db.users.getUser(target.id);

		if (db === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user hasn't interacted with the bot 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		return await this.bot.moderation.buildOverview(target, db);
    }
}