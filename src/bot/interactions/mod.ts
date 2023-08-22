import type { InteractionHandler } from "../types/interaction.js";
import type { CustomInteraction } from "../types/discordeno.js";
import type { DiscordBot } from "../mod.js";

import { getCooldown, setCooldown } from "../events/interaction/command.js";
import { handleError } from "../moderation/error.js";
import { EmbedColor } from "../utils/response.js";

import Settings from "./settings.js";

export const HANDLERS: InteractionHandler[] = [
	Settings
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
		const cooldown = getCooldown(interaction);

		if (cooldown) {
			return void await interaction.reply({
				embeds: {
					title: "Whoa-whoa... slow down ⏳",
					description: `This interaction is currently on cool-down. You can use it again <t:${Math.floor(cooldown.when / 1000)}:R>.`,
					color: EmbedColor.Yellow
				},

				ephemeral: true
			});
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