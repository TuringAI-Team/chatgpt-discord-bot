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
import { Categories, generateSections } from "../utils/settings.js";

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
		await interaction.edit({
			embeds: [
				{
					title: "The bot is under maintenance",
					description:
						"The bot is currently under maintenance, please try again later. Join our support server for more information.\n\n**How can I help?**\n- Be patient.\n- You can donate to the project in order to be able to continue providing this service for free",
					color: config.brand.color,
				},
			],
			components: [
				{
					type: MessageComponentTypes.ActionRow,
					components: [
						{
							type: MessageComponentTypes.Button,
							label: "Support Server",
							url: `https://discord.gg/${config.brand.invite}`,
							style: ButtonStyles.Link,
						},
						{
							// KO-FI
							type: MessageComponentTypes.Button,
							label: "Donate to the project",
							emoji: {
								id: 1162684912206360627n,
								name: "kofi",
							},
							url: "https://ko-fi.com/mrloldev",
							style: ButtonStyles.Link,
						},
					],
				},
			],
		});
	},
});

async function buildInfo(env: Environment, options: OptionResolver, interaction: Interaction): Promise<CreateMessageOptions> {
	const subcommand = options.getSubCommand();

	return {
		content: "Settings are currently under development.",
	}; /*
	if (subcommand === "me") {
		const section = await generateSections("chat", env);
		if (section) {
			await interaction.edit(section);
		}
	} else if (subcommand === "server") {
	}
	return {
		content: "Settings are currently under development.",
	};*/
}
