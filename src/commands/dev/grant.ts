import { SlashCommandBuilder } from "discord.js";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { DatabaseSubscription, DatabaseUser } from "../../db/schemas/user.js";
import { DatabaseGuild } from "../../db/schemas/guild.js";
import { Response } from "../../command/response.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

import relativeTime from "dayjs/plugin/relativeTime.js";
import duration from "dayjs/plugin/duration.js";

dayjs.extend(relativeTime);
dayjs.extend(duration);

export const SubscriptionDurationOptions = [
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
				.addSubcommand(builder => builder
					.setName("subscription")
					.setDescription("Change the subscription status of a user")
					.addStringOption(builder => builder
						.setName("type")
						.setDescription("For which type this subscription is")
						.setRequired(true)
						.addChoices(
							{ name: "Guild", value: "guild" },
							{ name: "User", value: "user" }
						)
					)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription("ID or tag of the user to grant the subscription")
						.setRequired(true)
					)
					.addStringOption(builder => builder
						.setName("duration")
						.setDescription("How long the subscription should last")
						.addChoices(...SubscriptionDurationOptions.map(duration => ({
							name: `${duration.humanize()}`,
							value: duration.asMilliseconds().toString()
						})), {
							name: "revoke 😔",
							value: "revoke"
						})
						.setRequired(true)
					)
				)
				.addSubcommand(builder => builder
					.setName("plan")
					.setDescription("Give credit to a pay-as-you-go plan user")
					.addStringOption(builder => builder
						.setName("type")
						.setDescription("For which type this plan is")
						.setRequired(true)
						.addChoices(
							{ name: "Guild", value: "guild" },
							{ name: "User", value: "user" }
						)
					)
					.addStringOption(builder => builder
						.setName("id")
						.setDescription("ID or tag of the user to grant the credit")
						.setRequired(true)
					)
					.addNumberOption(builder => builder
						.setName("amount")
						.setMaxValue(5000)
						.setDescription("How much credit to grant (0 or -1 removes their plan)")
						.setRequired(true)
					)
				)

        , { restriction: [ "owner" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Action to perform */
		const action: "subscription" | "plan" = interaction.options.getSubcommand(true) as any;

		/* For which type (user or guild) this subscription/plan grant is */
		const type: "guild" | "user" = interaction.options.getString("type", true) as any;

		/* ID of the entry */
		const id: string = interaction.options.getString("id", true);
		const target = await Utils.findType(this.bot, type, id);
		
		if (target === null) return new Response()
			.addEmbed(builder => builder
				.setDescription(`The specified ${type} does not exist 😔`)
				.setColor("Red")
			)
			.setEphemeral(true);

		/* Get the database entry of the user, if applicable. */
		const db: DatabaseUser | DatabaseGuild | null = await this.bot.db.users[type === "guild" ? "getGuild" : "getUser"](target.id);

		if (db === null) return new Response()
			.addEmbed(builder => builder
				.setDescription(`The specified ${type} hasn't interacted with the bot 😔`)
				.setColor("Red")
			)
			.setEphemeral(true);

		if (action === "subscription") {
			/* Duration of the granted subscription */
			const rawDuration: string = interaction.options.getString("duration", true);
			const duration: number = parseInt(rawDuration);
			
			/* Get the user's active subscription. */
			const subscription: DatabaseSubscription | null = db.subscription;

			if (rawDuration === "revoke" || isNaN(duration)) {
				if (subscription === null) return new Response()
					.addEmbed(builder => builder
						.setDescription(`The specified ${type} doesn't have an active subscription 😔`)
						.setColor("Red")
					)
					.setEphemeral(true);

				/* Revoke the user's subscription. */
				await this.bot.db.users.revokeSubscription(db, type);

				return new Response()
					.addEmbed(builder => builder
						.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
						.setTitle("Subscription revoked 😔")
						.setColor("Yellow")
						.setTimestamp()
					);
			}

			/* Grant the user a subscription of the specified duration. */
			await this.bot.db.users.grantSubscription(db, type, duration);

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle(`Subscription ${subscription !== null ? "updated" : "granted"} ✨`)
					.setColor("Yellow")
					.setTimestamp()
				);
				
		} else if (action === "plan") {
			/* Amount of credit to grant */
			const amount: number = interaction.options.getNumber("amount", true);

			/* Remove the user's plan. */
			if (amount <= 0) {
				if (db.plan === null) return new Response()
					.addEmbed(builder => builder
						.setDescription(`The specified ${type} doesn't have an active plan 😔`)
						.setColor("Red")
					)
					.setEphemeral(true);

				await this.bot.db.plan.remove(db);

				return new Response()
					.addEmbed(builder => builder
						.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
						.setTitle(`Plan removed 😔`)
						.setColor("Yellow")
						.setTimestamp()
					);
			}

			/* If the user doesn't have a plan already, create a new one for them. */
			if (db.plan === null) db.plan = await this.bot.db.plan.create(db);

			/* Grant the user the specified amount of credit. */
			const credit = await this.bot.db.plan.credit(db, {
				type: "grant", amount
			});

			return new Response()
				.addEmbed(builder => builder
					.setAuthor({ name: target.name, iconURL: target.icon ?? undefined })
					.setTitle(`**$${credit.amount}** in credit granted ✨`)
					.setColor("Yellow")
					.setTimestamp()
				);
		}
    }
}