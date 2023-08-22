import type { InteractionHandler } from "../types/interaction.js";
import type { CustomInteraction } from "../types/discordeno.js";
import type { DiscordBot } from "../mod.js";

import { cooldownNotice, getCooldown, hasCooldown, setCooldown } from "../utils/cooldown.js";
import { handleError } from "../moderation/error.js";

import Settings from "./settings.js";
import Premium from "./premium.js";

export const HANDLERS: InteractionHandler[] = [
	Settings, Premium
];

export async function handleInteraction(bot: DiscordBot, interaction: CustomInteraction) {
	if (!interaction.data || !interaction.data.customId) return;

	const args = interaction.data.customId.split(":");
	const name = args.shift()!;

	const handler = HANDLERS.find(c => c.name === name) ?? null;
	if (!handler) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);
	const type = bot.db.type(env);

	if (handler.cooldown) {
		if (hasCooldown(interaction)) {
			await interaction.reply(cooldownNotice(interaction));
			const { remaining } = getCooldown(interaction)!;

			return void setTimeout(() => {
				interaction.deleteReply().catch(() => {});
			}, remaining);
		} else {
			if (handler.cooldown[type]) setCooldown(interaction, handler.cooldown[type]!);
		}
	}

	try {
		const response = await handler.handler({
			bot, interaction, args, env
		});

		if (response) await interaction.reply(response);

	} catch (error) {
		await interaction.reply(
			await handleError(bot, { error, guild: interaction.guildId })
		);
	}
}