import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";

import { DatabaseInfo, UserSubscriptionType } from "../db/managers/user.js";
import { Command, CommandResponse } from "../command/command.js";
import { ErrorResponse } from "../command/response/error.js";
import { Response } from "../command/response.js";
import { PremiumRole } from "../util/roles.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";
import { ProgressBar } from "../util/progressBar.js";

export default class PremiumCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("premium")
                .setDescription("View all benefits and features of Premium")

				.addSubcommand(builder => builder
					.setName("info")
					.setDescription("View information about your active Premium subscription or plan")
				)
				.addSubcommand(builder => builder
					.setName("buy")
					.setDescription("Find out where to buy Premium")
				)
		);
    }

    public async run(interaction: ChatInputCommandInteraction, { user, guild }: DatabaseInfo): CommandResponse {
		/* Which sub-command to execute */
		const action: "info" | "buy" = interaction.options.getSubcommand(true) as any;

		/* If the command was run on the support server, check whether the user already has their Premium role. */
		if (guild && guild.id === this.bot.app.config.channels.moderation.guild && interaction.member instanceof GuildMember) {
			await PremiumRole.checkRole(this.bot, interaction.member);
		}

		/* Current subscription & plan */
		const subscriptions = {
			user: this.bot.db.users.subscription(user),
			guild: guild ? this.bot.db.users.subscription(guild) : null
		};

		const plans = {
			user: this.bot.db.plan.get(user),
			guild: guild ? this.bot.db.plan.get(guild) : null
		};

		/* Subscription type of the user */
		const type: UserSubscriptionType = this.bot.db.users.type({ user, guild });

		/* The user's permissions */
		const permissions = interaction.member instanceof GuildMember ? interaction.member.permissions : null;

		/* Whether the "Recharge" button should be shown */
		const showShopButton: boolean = user.metadata.email != undefined && (type.location === "guild" ? permissions !== null && permissions.has("ManageGuild") : true);

		/* View information about the benefits & perks of a subscription */
		if (action === "info") {
			const builder: EmbedBuilder = new EmbedBuilder()
				.setColor("Orange");

			const buttons: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setURL(Utils.shopURL())
						.setLabel("Visit our shop")
						.setEmoji("💸")
				);

			const response = new Response()
				.setEphemeral(true);

			if (type.premium) {
				if (type.type === "plan") {
					if (type.location === "guild") {
						/* Check whether the user has the "Manage Server" permission. */
						if (!permissions || !permissions.has("ManageGuild")) return new ErrorResponse({
							interaction, message: "You must have the `Manage Server` permission to view & manage the server's plan", emoji: "😔"
						});
					}

					/* The user's (or guild's) plan */
					const plan = plans[type.location]!;

					/* Previous plan expenses */
					const expenses = plan.expenses.slice(-10);

					if (expenses.length > 0) response.addEmbed(builder => builder
						.setTitle("Previous expenses")
						.setDescription("*This will show your last few expenses using the bot*.")
						.addFields(expenses.map(expense => ({
							name: `${Utils.titleCase(expense.type)}`,
							value: `**$${Math.round(expense.used * Math.pow(10, 5)) / Math.pow(10, 5)}** — *<t:${Math.floor(expense.time / 1000)}:F>*`
						})))
					);

					/* Previous plan purchase history */
					const history = plan.history.slice(-10);

					if (history.length > 0) response.addEmbed(builder => builder
						.setTitle("Previous charge-ups")
						.setDescription("*This will show your last few charge-ups or granted credits*.")
						.addFields(history.map(credit => ({
							name: `${Utils.titleCase(credit.type)}${credit.gateway ? `— *using **\`${credit.gateway}\`***` : ""}`,
							value: `**$${credit.amount.toFixed(2)}** — *<t:${Math.floor(credit.time / 1000)}:F>*`
						})))
					);

					const percentage = plan.used / plan.total;
					const size: number = 25;
					
					/* Whether the user has exceeded the limit */
					const exceededLimit: boolean = plan.used >= plan.total;

					/* Final, formatted diplay message */
					const displayMessage: string = !exceededLimit
						? `**$${plan.used.toFixed(2)}** \`${ProgressBar.display({ percentage, total: size })}\` **$${plan.total.toFixed(2)}**`
						: `_You ran out of credits for the **Pay-as-you-go** plan; re-charge credits ${showShopButton ? `using the **Purchase credits** button below` : `in **[our shop](${Utils.shopURL()})**`}_.`;

					builder.setTitle(`${type.location === "guild" ? "The server's" : "Your"} pay-as-you-go plan 📊` );
					builder.setDescription(displayMessage);

				} else if (type.type === "subscription" && subscriptions[type.location] !== null) {
					const subscription = subscriptions[type.location]!;
					builder.setTitle(`${type.location === "guild" ? "The server's" : "Your"} Premium subscription ✨`);

					builder.addFields(
						{
							name: "Premium subscriber since", inline: true,
							value: `<t:${Math.floor(subscription.since / 1000)}:F>`,
						},

						{
							name: "Subscription active until", inline: true,
							value: `<t:${Math.floor(subscription.expires / 1000)}:F>, <t:${Math.floor(subscription.expires / 1000)}:R>`,
						}
					);
				}

				if (type.premium) buttons.components.unshift(
					new ButtonBuilder()
						.setCustomId(`settings:menu:${type.location}:premium`)
						.setLabel("Settings").setEmoji("⚙️")
						.setStyle(ButtonStyle.Secondary)
				);

				/* Add the `Buy credits` button, if applicable. */
				if (showShopButton) buttons.components.unshift(
					new ButtonBuilder()
						.setCustomId(`premium:purchase:${type.type}`).setEmoji("🛍️")
						.setLabel(type.type === "subscription" ? "Extend your subscription" : "Purchase credits")
						.setStyle(ButtonStyle.Success)
				);

			} else {
				builder.setDescription("You can buy a **Premium** subscription or **Premium** credits for the plan below.");

				if (showShopButton) buttons.components.unshift(
					new ButtonBuilder()
						.setCustomId(`premium:purchase:plan`).setEmoji("🛍️")
						.setLabel("Purchase credits")
						.setStyle(ButtonStyle.Success),

					new ButtonBuilder()
						.setCustomId(`premium:purchase:subscription`).setEmoji("🛍️")
						.setLabel("Subscribe")
						.setStyle(ButtonStyle.Success)
				);
			}

			response
				.addComponent(ActionRowBuilder<ButtonBuilder>, buttons)
				.addEmbed(builder);

			return response;

		/* Find out where to buy a Premium subscription */
		} else if (action === "buy") {
			const buttons: ActionRowBuilder<ButtonBuilder> = new ActionRowBuilder<ButtonBuilder>()
				.addComponents(
					new ButtonBuilder()
						.setStyle(ButtonStyle.Link)
						.setURL(Utils.shopURL())
						.setLabel("Visit our shop")
						.setEmoji("💸")
				);

			const response = new Response()
				.addComponent(ActionRowBuilder<ButtonBuilder>, buttons)
				.setEphemeral(true);

			return response;
		}
    }
}