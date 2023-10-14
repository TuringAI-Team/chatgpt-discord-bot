import {
	ApplicationCommandOptionTypes,
	BigString,
	Bot,
	ButtonComponent,
	CreateMessageOptions,
	MessageComponentTypes,
} from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { env, premium } from "../utils/db.js";
import { generatePremiumEmbed } from "../utils/premium.js";
import { OptionResolver } from "../handlers/OptionResolver.js";

export default createCommand({
	body: {
		name: "settings",
		description: "...",
		options: [
			{
				name: "me",
				type: "SubCommand",
				description: "Customize the bot for yourself",
			},
			{
				name: "server",
				type: "SubCommand",
				description: "Customize the bot for the entire server",
			},
		],
	},
	cooldown: NoCooldown,
	isPrivate: true,
	interaction: async ({ interaction, options }) => {
		await interaction.edit({ ...(await buildInfo(options, interaction.user.id, interaction.guildId)) });
	},
});

async function buildInfo(options: OptionResolver, userId: BigString, guildId?: BigString): Promise<CreateMessageOptions> {
	const subcommand = options.getSubCommand();
	console.log(subcommand);
	const environment = await env(userId?.toString(), guildId?.toString());

	if (subcommand === "me") {

	} else if (subcommand === "server") {
	}
	return {
		content: "Settings are currently under development.",
	};
}
