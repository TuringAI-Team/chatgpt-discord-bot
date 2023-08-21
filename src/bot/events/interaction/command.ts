import { Collection } from "discordeno";

import type { CustomInteraction } from "../../types/discordeno.js";
import type { CommandOptionValue } from "../../types/command.js";
import type { DiscordBot } from "../../mod.js";

import { handleError } from "../../moderation/error.js";
import { ResponseError } from "../../error/response.js";
import { EmbedColor } from "../../utils/response.js";

import { COMMANDS } from "../../commands/mod.js";
import { canUse, restrictionTypes } from "../../utils/restriction.js";

/** Global command cool-downs */
const cooldowns: Collection<string, number> = new Collection();

export async function executeCommand(bot: DiscordBot, interaction: CustomInteraction) {
	if (!interaction.data) return;

	const command = COMMANDS.find(c => c.name === interaction.data?.name) ?? null;
	if (!command) return;

	const env = await bot.db.env(interaction.user.id, interaction.guildId);
	const type = bot.db.type(env);

	if (command.cooldown) {
		const cooldown = getCooldown(interaction);

		if (cooldown) {
			return void await interaction.reply({
				embeds: {
					title: "Whoa-whoa... slow down ⏳",
					description: `This command is currently on cool-down. You can use it again <t:${Math.floor(cooldown.when / 1000)}:R>.`,
					color: EmbedColor.Yellow
				},

				ephemeral: true
			});
		} else {
			if (command.cooldown[type]) setCooldown(interaction, command.cooldown[type]!);
		}
	}

	/* Whether the user can access this command */
	const access = command.restrictions
		? canUse(bot, env, command.restrictions)
		: true;

	if (command.restrictions && !access) {
		const allowed = restrictionTypes(command.restrictions);

		return void await interaction.reply({
			embeds: {
				description: `This command is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
				color: EmbedColor.Yellow
			},

			ephemeral: true
		});
	}

	const options: Record<string, CommandOptionValue> =
        parseCommandOptions(interaction);

	try {
		const response = await command.handler({
			bot, interaction, options, env
		});

		if (response) await interaction.reply(response);

	} catch (error) {
		if (error instanceof ResponseError) {
			return void await interaction.reply(
				error.display()
			);
		}

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

export function getCooldown(interaction: CustomInteraction) {
	const existing = cooldowns.get(cooldownKey(interaction)) ?? null;
	if (!existing || existing < Date.now()) return null;

	return {
		remaining: existing - Date.now(),
		when: existing
	};
}

export function setCooldown(interaction: CustomInteraction, duration: number) {
	cooldowns.set(cooldownKey(interaction), Date.now() + duration);
}

export function cooldownKey(interaction: CustomInteraction) {
	return `${interaction.user.id}-${interaction.data?.name}`;
}