import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseUser, DatabaseUserInfraction } from "../../db/schemas/user.js";
import { ErrorResponse } from "../../command/response/error.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class InfractionsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("infractions")
				.setDescription("Various stuff to do with infractions")
				.addSubcommand(builder => builder
					.setName("warn")
					.setDescription("Give a warning to a user")
					.addStringOption(builder => builder
						.setName("id")
						.setDescription("ID or name of the user to give a warning")
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("reason")
						.setDescription("Reason for the warning")
						.setRequired(false)
					)
				)
				.addSubcommand(builder => builder
					.setName("ban")
					.setDescription("(Un-)ban a user")
					.addStringOption(builder => builder
						.setName("id")
						.setDescription("ID or name of the user to (un-)ban")
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("reason")
						.setDescription("Reason for the (un-)ban")
						.setRequired(false)
					)
				)
				.addSubcommand(builder => builder
					.setName("remove")
					.setDescription("Remove an infraction from a user")
					.addStringOption(builder => builder
						.setName("id")
						.setDescription("ID or name of the user to remove the warning of")
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("which")
						.setDescription("ID of the infraction to remove")
						.setRequired(true)
					)
				)
		, { restriction: [ "moderator" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target = await Utils.findUser(this.bot, id);

		/* Reason for the warning */
		const reason: string | undefined = interaction.options.getString("reason") !== null ? interaction.options.getString("reason", true) : undefined;
		
		if (target === null) return new ErrorResponse({
			message: "The specified user does not exist"
		});

		/* Get the database entry of the user, if applicable. */
		let db: DatabaseUser | null = await this.bot.db.users.getUser(target.id);

		if (db === null) return new ErrorResponse({
			message: "The specified user hasn't interacted with the bot"
		});

		/* Which action to perform */
		const action = interaction.options.getSubcommand(true);

		if (action === "warn") {
			/* Send the warning to the user. */
			db = await this.bot.db.users.warn(db, {
				by: interaction.user.id,
				reason
			});

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setDescription(`\`\`\`\n${db!.infractions[db!.infractions.length - 1].reason}\n\`\`\``)
					.setTitle("Warning given ✉️")
					.setColor("Yellow")
					.setTimestamp()
				);

		} else if (action === "ban") {
			/* Whether the user should be banned / unbanned */
			const status: boolean = await this.bot.db.users.banned(db) === null;

			/* Reason for the warning */
			const reason: string | undefined = interaction.options.getString("reason") !== null
				? interaction.options.getString("reason", true)
				: status ? "Inappropriate use of the bot" : "Appealed";

			/* Ban / unban the user */
			await this.bot.db.users.ban(db, {
				by: interaction.user.id,
				status: status, reason
			});

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle(status ? "Banned 🔨" : "Un-banned 🙌")
					.setDescription(`\`\`\`\n${reason}\n\`\`\``)
					.setColor(status ? "Red" : "Yellow")
					.setTimestamp()
				);

		} else if (action === "remove") {
			/* ID of the infraction to remove */
			const which: string = interaction.options.getString("which", true);
			const infraction: DatabaseUserInfraction | null = db.infractions.find(i => i.id === which) ?? null;

			if (infraction === null) return new ErrorResponse({
				message: "The specified infraction does not exist"
			});

			if (infraction.type === "moderation" || infraction.type === "ban" || infraction.type === "warn") return new ErrorResponse({
				message: `You cannot remove infractions with the type \`${infraction.type}\``
			});

			db = await this.bot.db.users.removeInfraction(db, infraction);

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle("Warning removed ✉️")
					.setDescription(`\`\`\`\n${infraction.reason}\n\`\`\``)
					.setColor("Green")
					.setTimestamp()
				);
		}
    }
}