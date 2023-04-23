import { SlashCommandBuilder, User } from "discord.js";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { DatabaseUser, DatabaseSubscription } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

import relativeTime from "dayjs/plugin/relativeTime.js";
import duration from "dayjs/plugin/duration.js";

dayjs.extend(relativeTime);
dayjs.extend(duration);

export const SUBSCRIPTION_DURATION_OPTIONS = [
	dayjs.duration({ minutes: 1 }),
	dayjs.duration({ minutes: 5 }),
	dayjs.duration({ days: 7 }),
	dayjs.duration({ months: 1 }),
	dayjs.duration({ months: 3 }),
	dayjs.duration({ years: 1 }),
	dayjs.duration({ years: 99 })
]

export default class GrantCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("grant")
				.setDescription("Change the subscription status of a user")
				.addStringOption(builder => builder
					.setName("id")
					.setDescription("ID or tag of the user to grant the subscription")
					.setRequired(true)
				)
				.addStringOption(builder => builder
					.setName("duration")
					.setDescription("How long the subscription should last")
					.addChoices(...SUBSCRIPTION_DURATION_OPTIONS.map(duration => ({
						name: `${duration.humanize()}`,
						value: `duration:${duration.asMilliseconds()}`
					})), {
						name: "revoke 😔",
						value: "revoke"
					})
					.setRequired(true)
				)
        , { private: CommandPrivateType.OwnerOnly });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* ID of the user */
		const id: string = interaction.options.getString("id", true);
		const target: User | null = await Utils.findUser(this.bot, id);

		/* Duration of the granted subscription */
		const rawDuration: string = interaction.options.getString("duration", true).split(":")[1];
		const duration: number = parseInt(rawDuration);
		
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

		/* Get the user's active subscription. */
		const subscription: DatabaseSubscription | null = db.subscription;

		if (rawDuration === "revoke" || isNaN(duration)) {
			if (subscription === null) return new Response()
				.addEmbed(builder => builder
					.setDescription("The specified user doesn't have an active subscription 😔")
					.setColor("Red")
				)
				.setEphemeral(true);

			/* Revoke the user's subscription. */
			await this.bot.db.users.revokeSubscription(db, "user");

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
					.setTitle("Subscription revoked 😔")
					.setColor("Yellow")
					.setTimestamp()
				);
		}

		/* Grant the user a subscription of the specified duration. */
		await this.bot.db.users.grantSubscription(db, "user", duration);

		return new Response()
			.addEmbed(builder => builder
				.setAuthor({ name: target.tag, iconURL: target.displayAvatarURL() })
				.setTitle(`Subscription ${subscription !== null ? "updated" : "granted"} ✨`)
				.setColor("Yellow")
				.setTimestamp()
			);
    }
}