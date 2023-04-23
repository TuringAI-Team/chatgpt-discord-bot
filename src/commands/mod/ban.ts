import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseUser } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class BanCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("ban")
				.setDescription("Ban/unban a user")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to ban/unban")
					.setRequired(true)
				)
				.addStringOption(builder => builder
					.setName("reason")
					.setDescription("Reason for the ban/unban")
					.setRequired(false)
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

		/* Whether the user should be banned / unbanned */
		const action: boolean = !this.bot.db.users.banned(db);

		/* Reason for the warning */
		const reason: string | undefined = interaction.options.getString("reason") !== null
			? interaction.options.getString("reason", true)
			: action ? "Inappropriate use of the bot" : "Appealed";

		/* Ban / unban the user */
		await this.bot.db.users.ban(db, {
			by: interaction.user.id,
			status: action,
			reason
		});

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setTitle(action ? "Banned 🔨" : "Un-banned 🙌")
				.setDescription(`\`\`\`\n${reason}\n\`\`\``)
				.setColor(action ? "Red" : "Yellow")
				.setTimestamp()
			);
    }
}