// TODO: generate premium embed

import { Subscription } from "@supabase/supabase-js";
import { Environment } from "../../types/other.js";
import { premium, supabase, update } from "./db.js";
import { Plan } from "../../types/subscription.js";
import config from "../../config.js";
import {
	MessageComponentTypes,
	ButtonComponent,
	DiscordEmbed,
	CreateMessageOptions,
	MessageComponents,
	DiscordEmbedField,
} from "@discordeno/bot";
import { ButtonStyles, DiscordButtonComponent } from "@discordeno/bot";

const buttons: Array<DiscordButtonComponent> = [
	{
		type: MessageComponentTypes.Button,
		label: "💸 Visit our shop",
		url: "https://app.turing.sh/pay",
		style: ButtonStyles.Link,
	},
];
export const requiredPremium = {
	content: "",
	embeds: [
		{
			title: "This is a premium feature",
			description: "You can get premium by donating to the project. [Click here](https://app.turing.sh/pay)",
			color: config.brand.color,
		},
	],
	components: [
		{
			type: MessageComponentTypes.ActionRow,
			components: [
				{
					type: MessageComponentTypes.Button,
					label: "💸 Visit our shop",
					style: ButtonStyles.Link,
					url: "https://app.turing.sh/pay",
				},
			] as [ButtonComponent],
		},
	],
};

export async function generatePremiumEmbed(premiumInfo: {
	environment: Environment;
	premiumSelection: {
		type: "plan" | "subscription";
		location: "user" | "guild";
	} | null;
}) {
	const user = premiumInfo.environment.user;
	const guild = premiumInfo.environment.guild;
	const embeds: DiscordEmbed[] = [];
	if (!premiumInfo.premiumSelection) {
		embeds.push({
			title: "Premium",
			description: "You don't have any premium plan or subscription.",
			color: config.brand.color,
		});
	} else if (premiumInfo.premiumSelection.type === "plan" && (user.plan || guild?.plan)) {
		// FIST  EMBED: EXPENSES
		const expensesFields: DiscordEmbedField[] = [];
		if (premiumInfo.premiumSelection.location === "user" && user.plan) {
			for (const expense of user.plan.expenses) {
				if (expensesFields.length >= 10) break;
				expensesFields.push({
					name: `${expense.type.slice(0, 1).toUpperCase()}${expense.type.slice(1)} - using \`${expense.data.model}\` - $${
						expense.used?.toFixed(5) ?? "0"
					}`,
					value: `<t:${Math.floor(expense.time / 1000)}:R>`,
				});
			}
		} else if (premiumInfo.premiumSelection.location === "guild" && guild?.plan) {
			for (const expense of guild.plan.expenses) {
				if (expensesFields.length >= 10) break;
				expensesFields.push({
					name: `${expense.type.slice(0, 1).toUpperCase()}${expense.type.slice(1)} - using \`${expense.data.model}\` - $${
						expense.used?.toFixed(5) ?? "0"
					}`,
					value: `<t:${Math.floor(expense.time / 1000)}>`,
				});
			}
		}
		embeds.push({
			title: "Previous expenses 💸",
			timestamp: new Date().toISOString(),
			color: config.brand.color,
			fields: expensesFields,
		});
		// SECOND EMBED: Charges ups
		const chargesFields: DiscordEmbedField[] = [];
		if (premiumInfo.premiumSelection.location === "user" && user.plan) {
			if (user.plan.history && user.plan.history.length > 0) {
				for (const charge of user.plan.history) {
					if (chargesFields.length >= 10) break;
					chargesFields.push({
						name: `${charge.type.slice(0, 1).toUpperCase()}${charge.type.slice(1)} ${
							charge.gateway ? `- using \`${charge.gateway}\`` : ""
						}`,
						value: `$${charge.amount?.toFixed(2) ?? "0"} - <t:${Math.floor(charge.time / 1000)}>`,
					});
				}
			}
		} else if (premiumInfo.premiumSelection.location === "guild" && guild?.plan) {
			for (const charge of guild.plan.history) {
				if (chargesFields.length >= 10) break;
				chargesFields.push({
					name: `${charge.type.slice(0, 1).toUpperCase()}${charge.type.slice(1)} ${
						charge.gateway ? `- using \`${charge.gateway}\`` : ""
					}`,
					value: `$${charge.amount?.toFixed(2)} - <t:${Math.floor(charge.time / 1000)}>`,
				});
			}
		}
		if (chargesFields.length > 0) {
			embeds.push({
				title: "Previous charges-ups 💸",
				timestamp: new Date().toISOString(),
				color: config.brand.color,
				fields: chargesFields,
			});
		}

		// LAST EMBED
		let description = "";
		if (premiumInfo.premiumSelection.location === "user" && user.plan) {
			description = `**$${user.plan?.used?.toFixed(2)}**\`${generateProgressBar(user.plan.total, user.plan.used)}\`**$${
				user.plan?.total
			}**`;
		} else if (premiumInfo.premiumSelection.location === "guild" && guild?.plan) {
			description = `**$${guild.plan?.used?.toFixed(2)}**\`${generateProgressBar(guild.plan.total, guild.plan.used)}\`**$${
				guild.plan?.total
			}**`;
		}
		embeds.push({
			title: "Your pay-as-you-go plan 📊",
			description: description,
			color: config.brand.color,
		});
	} else if (premiumInfo.premiumSelection.type === "subscription" && (user.subscription || guild?.subscription)) {
		let since = "";
		let expires = "";
		if (user.subscription && premiumInfo.premiumSelection.location === "user") {
			since = `<t:${Math.floor(user.subscription.since / 1000)}>`;
			expires = `<t:${Math.floor(user.subscription.expires / 1000)}>`;
		} else if (guild?.subscription && premiumInfo.premiumSelection.location === "guild") {
			since = `<t:${Math.floor(guild.subscription.since / 1000)}>`;
			expires = `<t:${Math.floor(guild.subscription.expires / 1000)}>`;
		}
		embeds.push({
			title: `${premiumInfo.premiumSelection.location === "user" ? "Your" : "This guild's"} subscription 📅`,
			description: `You have a ${premiumInfo.premiumSelection.location === "user" ? "user" : "guild"} subscription.`,
			fields: [
				{
					name: "Premium subscriber since",
					value: since,
				},
				{
					name: "Expires",
					value: expires,
				},
			],
			color: config.brand.color,
		});
	}
	const components: MessageComponents = [
		{
			type: MessageComponentTypes.ActionRow,
			components: [
				{
					type: MessageComponentTypes.Button,
					label: "💸 Visit our shop",
					url: "https://app.turing.sh/pay",
					style: ButtonStyles.Link,
				},
			] as [ButtonComponent],
		},
	];
	return {
		embeds: embeds,
		components: components,
		ephemeral: true,
	};
}

function generateProgressBar(max: number, current: number, barChar = "█", spaceChar = " "): string {
	const percentage = (current / max) * 100;
	const width = 40; // Adjust the width as needed
	const completed = Math.round((width * percentage) / 100);

	const progressBar = [barChar.repeat(completed), spaceChar.repeat(width - completed)].join("");

	return `[${progressBar}]`;
}

async function premCheck() {
	const { data: PremiumUsers, error } = await supabase.from("guilds_new").select("*").neq("subscription", null);
	if (error) return console.log(error);

	const filtered = PremiumUsers.filter((x) => (x.subscription?.since ? true : false));
	for (const user of filtered) {
		const since = user.subscription?.since;
		// check if is a number and not null
		if (typeof since === "number") {
			// check if expired before the end of august
			if (user.subscription?.expires && user.subscription.expires < new Date("2023-08-20T00:00:00.000Z").getTime()) {
				console.log(`User ${user.id} has an expired subscription`);
				continue;
			}
			// change expires to next month
			await update("users", user.id, {
				subscription: {
					...user.subscription,
					expires: since + 30 * 24 * 60 * 60 * 1000,
				},
			});
			console.log(`Updated user ${user.id}`);
		}
	}
}

export async function chargePlan(cost: number, environment: Environment, type: "chat" | "image", model: string) {
	const prem = await premium(environment);
	if (!prem || prem.type !== "plan") return false;
	if (prem.location === "user") {
		if (!environment.user?.plan) return false;
		await update("users", environment.user.id, {
			plan: {
				used: environment.user.plan.used + cost,
				total: environment.user.plan.total,
				history: environment.user.plan.history ?? [],
				expenses: [
					...(environment.user.plan.expenses ?? []),
					{
						data: {
							model,
						},
						type: type,
						used: cost,
						time: Date.now(),
					},
				],
			},
		});
	} else if (prem.location === "guild") {
		if (!environment.guild?.plan) return false;
		await update("guilds", environment.guild.id, {
			plan: {
				used: environment.guild.plan.used + cost,
				total: environment.guild.plan.total,
				history: environment.guild.plan.history ?? [],
				expenses: [
					...(environment.guild.plan.expenses ?? []),
					{
						data: {
							model,
						},
						type: type,
						used: cost,
						time: Date.now(),
					},
				],
			},
		});
	}
}
