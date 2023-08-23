import { ButtonComponent, ButtonStyles, Embed, MessageComponentTypes, calculatePermissions } from "discordeno";

import type { DBPlan, PlanExpense } from "../db/types/premium.js";
import type { CustomInteraction } from "./types/discordeno.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";
import type { DiscordBot } from "./mod.js";

import { EmbedColor, type MessageResponse } from "./utils/response.js";
import { ResponseError } from "./error/response.js";
import { titleCase } from "./utils/helpers.js";
import { displayBar } from "./utils/bar.js";

export function buildOverview(bot: DiscordBot, interaction: CustomInteraction, { user, guild }: DBEnvironment) {
	/* Current subscription & plan */
	const subscriptions = {
		user: user.subscription, guild: guild ? guild.subscription : null
	};

	const plans = {
		user: user.plan, guild: guild ? guild.plan : null
	};

	/* Subscription type of the user */
	const type = bot.db.premium({ user, guild });

	/* The user's permissions */
	const permissions = interaction.member && interaction.member.permissions
		? calculatePermissions(interaction.member.permissions)
		: null;

	/* Whether the "Recharge" button should be shown, for server Premium */
	const showShopButton: boolean = user.metadata.email != undefined && (type?.location === "guild" ? permissions !== null && permissions.includes("MANAGE_GUILD") : true);

	const embed: Embed = {
		color: EmbedColor.Orange
	};

	const buttons: ButtonComponent[] = [
		{
			type: MessageComponentTypes.Button,
			label: "Visit the shop", emoji: { name: "💸" },
			url: "https://app.turing.sh/pay", style: ButtonStyles.Link
		}
	];

	const response: Omit<MessageResponse, "embeds"> & { embeds: Embed[] } = {
		ephemeral: true, embeds: []
	};

	if (type !== null) {
		if (type.type === "plan") {
			if (type.location === "guild") {
				if (permissions && !permissions.includes("MANAGE_GUILD")) throw new ResponseError({
					message: "You must have the `Manage Server` permission to view & manage the server's plan", emoji: "😔"
				});
			}

			/* The user's (or guild's) plan */
			const plan = plans[type.location]!;

			/* Previous plan expenses */
			const expenses = plan.expenses.filter(e => e.type !== "api").slice(-10);

			if (expenses.length > 0) response.embeds.push({
				title: "Previous expenses",

				fields: expenses.map(expense => {
					return {
						name: `${titleCase(expense.type)} — **$${Math.round(expense.used * Math.pow(10, 5)) / Math.pow(10, 5)}**`,
						value: `*<t:${Math.floor(expense.time / 1000)}:F>*`
					};
				})
			});

			/* Previous plan purchase history */
			const history = plan.history.slice(-10);

			if (history.length > 0) response.embeds.push({
				title: "Previous charge-ups",

				fields: history.map(credit => ({
					name: `${titleCase(credit.type)}${credit.gateway ? `— *using **\`${credit.gateway}\`***` : ""}`,
					value: `**$${credit.amount.toFixed(2)}** — *<t:${Math.floor(credit.time / 1000)}:F>*`
				}))
			});

			const percentage = plan.used / plan.total;
			const size: number = 25;
			
			/* Whether the user has exceeded the limit */
			const exceededLimit: boolean = plan.used >= plan.total;

			/* Final, formatted diplay message */
			const displayMessage: string = !exceededLimit
				? `**$${plan.used.toFixed(2)}** \`${displayBar({ percentage, total: size })}\` **$${plan.total.toFixed(2)}**`
				: `_You ran out of credits for the **Pay-as-you-go** plan; re-charge credits ${showShopButton ? "using the **Purchase credits** button below" : "in **[our shop](https://app.turing.sh/pay)**"}_.`;

			embed.title = `${type.location === "guild" ? "The server's" : "Your"} pay-as-you-go plan 📊`;
			embed.description = displayMessage;

		} else if (type.type === "subscription") {
			const subscription = subscriptions[type.location]!;
			embed.title = `${type.location === "guild" ? "The server's" : "Your"} Premium subscription ✨`;

			embed.fields = [
				{
					name: "Premium subscriber since", inline: true,
					value: `<t:${Math.floor(subscription.since / 1000)}:F>`,
				},

				{
					name: "Subscription active until", inline: true,
					value: `<t:${Math.floor(subscription.expires / 1000)}:F>, <t:${Math.floor(subscription.expires / 1000)}:R>`,
				}
			];
		}

		buttons.unshift({
			type: MessageComponentTypes.Button,
			label: "Settings", emoji: { name: "⚙️" },
			customId: `settings:view:${type.location}:premium`,
			style: ButtonStyles.Secondary
		});

		if (showShopButton) buttons.unshift({
			type: MessageComponentTypes.Button,
			label: type.type === "subscription" ? "Extend your subscription" : "Purchase credits",
			emoji: { name: "🛍️" }, customId: `premium:purchase:${type.type}`,
			style: ButtonStyles.Secondary
		});

	} else {
		embed.description = "You can buy a **Premium** subscription or **Premium** credits for the plan below.";

		if (showShopButton) buttons.unshift(
			{
				type: MessageComponentTypes.Button,
				label: "Purchase credits", emoji: { name: "🛍️" },
				customId: "premium:purchase:plan",
				style: ButtonStyles.Success
			},

			{
				type: MessageComponentTypes.Button,
				label: "Subscribe", emoji: { name: "🛍️" },
				customId: "premium:purchase:subscription",
				style: ButtonStyles.Success
			}
		);
	}

	response.embeds.push(embed);

	response.components = [
		{
			type: MessageComponentTypes.ActionRow,
			components: buttons as [ ButtonComponent ]
		}
	];

	return response;
}

export async function charge<T extends PlanExpense>(
	bot: DiscordBot, env: DBEnvironment, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: number }
): Promise<T | null> {
	if (used === 0) return null;

	const premium = bot.db.premium(env);
	if (!premium || premium.type !== "plan") return null;

	/* Which entry gets charged for this expense, guild or user */
	const entry = env[premium.location]!;
	if (!isPlanRunning(entry)) return null;
	
	/* The new expense */
	const expense: T = {
		type, used, data,
		time: Date.now()
	} as T;

	const updatedUsage = Math.max(
		entry.plan.used + used * (bonus ?? 0 + 1), 0
	);

	await bot.db.update(location(entry), entry, {
		plan: {
			...entry.plan,

			expenses: [ ...entry.plan.expenses, expense ],
			used: updatedUsage
		}
	});

	return expense;
}

function isPlanRunning(entry: DBGuild | DBUser): entry is DBGuild & { plan: DBPlan } | DBUser & { plan: DBPlan } {
	return entry.plan !== null && entry.plan.total > entry.plan.used;
}

function location(entry: DBGuild | DBUser) {
	return (entry as DBUser).interactions ? "users" : "guilds";
}