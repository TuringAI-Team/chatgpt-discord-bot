// TODO: generate premium embed

import { Subscription } from "@supabase/supabase-js";
import { Environment } from "../../types/other.js";
import { premium } from "./db.js";
import { Plan } from "../../types/subscription.js";
import config from "../../config.js";
import { MessageComponentTypes, ButtonComponent } from "@discordeno/bot";
import { ButtonStyles, DiscordButtonComponent } from "@discordeno/bot";

export async function getPremiumInfo(env: Environment) {
	const premiumInfo = await premium(env);
}

const buttons: Record<"buy", DiscordButtonComponent> = {
	buy: {
		type: MessageComponentTypes.Button,
		label: "Add me to your server",
		//url: ``,
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
}) {
	return {
		embeds: [
			{
				title: "Bot Statistics",

				color: config.brand.color,
			},
			{
				color: config.brand.color,
				title: "Partners 🤝",
				description: config.partners
					.map((p) => `${p.emoji ? `${p.emoji} ` : ""}[**${p.name}**](${p.url})${p.description ? ` — *${p.description}*` : ""}`)
					.join("\n"),
			},
		],
		components: [
			{
				type: MessageComponentTypes.ActionRow,
				components: Object.values(buttons) as [ButtonComponent],
			},
		],
	};
}
