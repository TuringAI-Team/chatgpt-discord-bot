import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { buildUserOverview } from "../../util/moderation/moderation.js";
import { DatabaseUser } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class UserCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("user")
				.setDescription("View information about a user - moderator only")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to view")
					.setRequired(true)
				)
        , { private: CommandPrivateType.ModeratorOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target: User | null = await Utils.findUser(this.bot, id);
		
		if (target === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user does not exist 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Get the database entry of the user, if applicable. */
		const db: DatabaseUser | null = await this.bot.db.users.getUser(target);

		if (db === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user hasn't interacted with the bot 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		return await buildUserOverview(this.bot, target, db);
    }
}