import { Collection } from "discordeno";

import type { CustomInteraction } from "../../types/discordeno.js";
import type { CommandOptionValue } from "../../types/command.js";
import type { DiscordBot } from "../../index.js";

import { handleError } from "../../moderation/error.js";
import { EmbedColor } from "../../utils/response.js";

import { COMMANDS } from "../../commands/index.js";

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export async function executeCommand(bot: DiscordBot, interaction: CustomInteraction) {
	if (!interaction.data) return;

	const command = COMMANDS.find(c => c.name === interaction.data?.name) ?? null;
	if (!command) return;

	if (command.cooldown) {
		const cooldown = getCooldown(interaction);

		if (cooldown) {
			return void await interaction.reply({
				embeds: {
					title: "Whoa-whoa... slow down ⏳",
					description: `This command is currently on cool-down. You can execute it again <t:${Math.floor(cooldown.when / 1000)}:R>.`,
					color: EmbedColor.Yellow
				},

				ephemeral: true
			});
		} else {
			setCooldown(interaction, command.cooldown.time);
		}
	}


	const args: Record<string, CommandOptionValue> =
        parseCommandOptions(interaction);

	try {
		const response = await command.handler(bot, interaction, args);
		if (response) await interaction.reply(response);

	} catch (error) {
		await interaction.reply(
			await handleError(bot, { error, guild: interaction.guildId })
		);
	}
}

function parseCommandOptions(interaction: CustomInteraction) {
	const args: Record<string, CommandOptionValue> = {};

	if (interaction.data!.options) for (const option of interaction.data!.options) {
		const name = option.name;
		args[name] = option as CommandOptionValue;
	}

	return args;
}

function getCooldown(interaction: CustomInteraction) {
	const existing = cooldowns.get(cooldownKey(interaction)) ?? null;
	if (!existing || existing < Date.now()) return null;

	return {
		remaining: existing - Date.now(),
		when: existing
	};
}

function setCooldown(interaction: CustomInteraction, duration: number) {
	cooldowns.set(cooldownKey(interaction), Date.now() + duration);
}

function cooldownKey(interaction: CustomInteraction) {
	return `${interaction.user.id}-${interaction.data?.name}`;
}