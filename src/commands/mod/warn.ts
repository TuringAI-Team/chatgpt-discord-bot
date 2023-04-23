import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseUser, DatabaseUserInfraction, } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class WarningCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("warn")
				.setDescription("Send a warning to a user - moderator only")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to warn")
					.setRequired(true)
				)
				.addStringOption(builder => builder
					.setName("reason")
					.setDescription("Reason for the warning")
					.setRequired(false)
				)
		, { private: CommandPrivateType.ModeratorOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target: User | null = await Utils.findUser(this.bot, id);

		/* Reason for the warning */
		const reason: string | undefined = interaction.options.getString("reason") !== null ? interaction.options.getString("reason", true) : undefined;
		
		if (target === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user does not exist 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Get the database entry of the user, if applicable. */
		let db: DatabaseUser | null = await this.bot.db.users.getUser(target);

		if (db === null) return new Response()
			.addEmbed(builder => builder
				.setDescription("The specified user hasn't interacted with the bot 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Send the warning to the user. */
		await this.bot.db.users.warn(db, {
			by: interaction.user.id,
			reason
		});

		/* Fetch the user's infractions again. */
		db = await this.bot.db.users.fetchUser(target);
		const infractions: DatabaseUserInfraction[] = this.bot.db.users.unread(db);

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setDescription(`\`\`\`\n${infractions[infractions.length - 1].reason}\n\`\`\``)
				.setTitle("Warning given ✉️")
				.setColor("Yellow")
				.setTimestamp()
			);
    }
}