import { BigString, Bot, ButtonComponent, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { env, premium } from "../utils/db.js";
import { generatePremiumEmbed } from "../utils/premium.js";

export default createCommand({
	body: {
		name: "premium",
		description: "View information about Premium & your current subscription",
	},
	cooldown: NoCooldown,
	interaction: async ({ interaction }) => {
		await interaction.edit({ ...(await buildInfo(interaction.bot, interaction.user.id, interaction.guildId)) });
	},
});

async function buildInfo(bot: Bot, userId: BigString, guildId?: BigString): Promise<CreateMessageOptions> {
	const environment = await env(userId?.toString(), guildId?.toString());
	if (!environment)
		return {
			content: "You don't have any premium plan or subscription.",
		};
	const premiumInfo = await premium(environment);
	const embed = await generatePremiumEmbed({
		environment: environment,
		premiumSelection: premiumInfo,
	});
	return embed;
}
