import {
	ApplicationCommandOptionTypes,
	BigString,
	Bot,
	ButtonComponent,
	ButtonStyles,
	CreateMessageOptions,
	Interaction,
	MessageComponentTypes,
} from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { premium } from "../utils/db.js";
import { generatePremiumEmbed } from "../utils/premium.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { Environment } from "../../types/other.js";
import { Categories, EnabledSections, EnabledSectionsTypes, generateSections } from "../utils/settings.js";

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
	interaction: async ({ interaction, options, env }) => {
		await interaction.edit(await buildInfo(env, options, interaction));
	},
});

async function buildInfo(env: Environment, options: OptionResolver, interaction: Interaction): Promise<CreateMessageOptions> {
	const subcommand = options.getSubCommand();

	if (subcommand === "me") {
		let page = EnabledSections[0];
		const newValue = options?.getString("page") ?? null;
		if (newValue) {
			page = newValue.toLowerCase() as EnabledSectionsTypes;
		}
		const section = await generateSections(page, env);
		if (section) {
			return section;
		} else {
			return {
				content: "No section found",
			};
		}
	}
	return {
		content: "This feature is not available yet",
	};
}
