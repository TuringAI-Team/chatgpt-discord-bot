import { SlashCommandBuilder, User } from "discord.js";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseUser, UserTestingGroup } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

export default class TesterCommand extends Command {
    constructor(bot: Bot) {
        super(bot, new SlashCommandBuilder()
			.setName("tester")
			.setDescription("Change the tester status of a user")
			.addStringOption(builder => builder
				.setName("id")
				.setDescription("ID or tag of the user to change the tester status of")
				.setRequired(true)
			)
			.addIntegerOption(builder => builder
				.setName("group")
				.setDescription("Which testing group the user should be in")
				.addChoices(...Object.entries(UserTestingGroup).filter(([a, b]) => typeof a === "string" && a.length > 1).map(([name, value]) => ({
					name: name as string,
					value: value as number
				})))
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
		const group: UserTestingGroup = interaction.options.getInteger("group", true);
		await this.bot.db.users.updateTesterStatus(targetUser, group);

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setDescription(`Testing group changed to **${UserTestingGroup[group]}**`)
				.setColor("Orange")
				.setTimestamp()
			);
    }
}