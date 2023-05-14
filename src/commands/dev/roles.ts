import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { UserRole, UserRoleHierarchy } from "../../db/managers/role.js";
import { ErrorResponse } from "../../command/response/error.js";
import { DatabaseUser } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

type RoleActionType = "add" | "remove"

interface RoleAction {
	name: RoleActionType;
	description: string;
}

const RoleActions: RoleAction[] = [
	{
		name: "add",
		description: "Give roles to a user"
	},

	{
		name: "remove",
		description: "Remove roles from a user"
	}
]

export default class RolesCommand extends Command {
    constructor(bot: Bot) {
		const builder = new SlashCommandBuilder()
			.setName("roles").setDescription("Change the roles of a user");

		RoleActions.forEach(action => {
			builder.addSubcommand(builder => builder
				.setName(action.name)
				.setDescription(action.description)
				.addStringOption(builder => builder
					.setName("id")
					.setDescription(`ID or tag of the user to ${action.name} the roles`)
					.setRequired(true)
				)
				.addStringOption(builder => builder
					.setName("role")
					.setDescription(`Which role to change`)
					.addChoices(...UserRoleHierarchy.map(role => ({
						name: Utils.titleCase(role),
						value: role
					})))
					.setRequired(true)
				)
			);
		})

        super(bot, builder, { restriction: "owner" });
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

		/* Action to take */
		const action: RoleActionType = interaction.options.getSubcommand(true) as RoleActionType;

		/* Which role to change */
		const role: UserRole = interaction.options.getString("role", true) as UserRole;

		if ((action === "add" && this.bot.db.role.has(db, role)) || (action === "remove" && !this.bot.db.role.has(db, role))) return new ErrorResponse({
			interaction, message: `${action === "add" ? `The user already has` : "The user doesn't have"} the **${Utils.titleCase(role)}** role`, emoji: "😔"
		});

		await this.bot.db.role.change(db, {
			[action]: [ role ]
		});

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setDescription(`Role **${Utils.titleCase(role)}** ${action === "add" ? "added" : "removed"}`)
				.setColor("Yellow")
				.setTimestamp()
			);
    }
}