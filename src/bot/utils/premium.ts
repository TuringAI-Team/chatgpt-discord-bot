// TODO: generate premium embed

import { Subscription } from "@supabase/supabase-js";
import { Environment } from "../../types/other.js";
import { premium } from "./db.js";
import { Plan } from "../../types/subscription.js";
import config from "../../config.js";
import { MessageComponentTypes, ButtonComponent, DiscordEmbed } from "@discordeno/bot";
import { ButtonStyles, DiscordButtonComponent } from "@discordeno/bot";

export async function getPremiumInfo(env: Environment) {
	const premiumInfo = await premium(env);
}

const buttons: Record<"buy", DiscordButtonComponent> = {
	buy: {
		type: MessageComponentTypes.Button,
		label: "💸 Visit our shop",
		url: "https://app.turing.sh/pay",
		style: ButtonStyles.Link,
	},
};

export async function generateEmbed(premiumInfo: {
	user: {
		subscription?: Subscription;
		plan?: Plan;
	};
	guild?: {
		subscription?: Subscription;
		plan?: Plan;
	};
	premiumSelection: {
		type: "plan" | "subscription";
		location: "user" | "guild";
	} | null
}) {
	const embeds: DiscordEmbed[] = []
	if (!premiumInfo.premiumSelection) {
		embeds.push({
			title: "Premium",
			description: "You don't have any premium plan or subscription.",
			color: config.brand.color,
		})
	} else {

		if (premiumInfo.premiumSelection.type == "plan" && (premiumInfo.user.plan || premiumInfo.guild?.plan)) {
			let description = "";
			if (premiumInfo.premiumSelection.location == "user" && premiumInfo.user.plan) {
				description = `**$ ${premiumInfo.user.plan?.used}**` + '`' + generateProgressBar(premiumInfo.user.plan.total, premiumInfo.user.plan.used) + '`' + `\n\n**$ ${premiumInfo.user.plan?.total}**`
			} else if (premiumInfo.premiumSelection.location == "guild" && premiumInfo.guild?.plan) {
				description = `**$ ${premiumInfo.guild.plan?.used}**` + '`' + generateProgressBar(premiumInfo.guild.plan.total, premiumInfo.guild.plan.used) + '`' + `\n\n**$ ${premiumInfo.guild.plan?.total}**`
			}
			embeds.push({
				title: "Your pay-as-you-go plan 📊",
				description: description,
				color: config.brand.color,
			})
		}
	}

	return {
		embeds: embeds,
		components: [
			{
				type: MessageComponentTypes.ActionRow,
				components: Object.values(buttons) as [ButtonComponent],
			},
		],
		ephemeral: true,
	};
}

function generateProgressBar(max: number, current: number, barChar = '█', spaceChar = ' '): string {
	const percentage = (current / max) * 100;
	const width = 40; // Adjust the width as needed
	const completed = Math.round((width * percentage) / 100);

	const progressBar = [
		barChar.repeat(completed),
		spaceChar.repeat(width - completed)
	].join('');

	return '[' + progressBar + '] ' +
		`${percentage.toFixed(2)}% (${current}/${max})`;
}