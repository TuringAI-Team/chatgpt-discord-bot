import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseUser } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";


export default class ModeratorCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("mod")
				.setDescription("Change the moderator status of a user")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to grant/revoke moderator privileges")
					.setRequired(true)
				)
        , { private: CommandPrivateType.OwnerOnly });
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
		const targetUser: DatabaseUser | null = await this.bot.db.users.getUser(target);

		if (targetUser === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user hasn't interacted with the bot 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* What to change the moderator status to */
		const status: boolean = !targetUser.moderator;
		await this.bot.db.users.updateModeratorStatus(targetUser, status);

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setTitle(`Moderator privileges ${status ? "granted ⚒️" : "revoked 😭"}`)
				.setColor("Orange")
				.setTimestamp()
			);
    }
}