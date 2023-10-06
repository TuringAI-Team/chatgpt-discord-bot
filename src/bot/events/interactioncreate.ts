import { EventHandlers, Interaction, InteractionTypes, logger } from "@discordeno/bot";
import { Environment } from "../../types/other.js";
import { NoCooldown } from "../config/setup.js";
import { OptionResolver } from "../handlers/OptionResolver.js";
import { commands } from "../index.js";
import { Command } from "../types/command.js";
import { checkCooldown } from "../utils/cooldown.js";
import { env, premium, voted } from "../utils/db.js";

export const interactionCreate: EventHandlers["interactionCreate"] = async (interaction) => {
	switch (interaction.type) {
		case InteractionTypes.ApplicationCommand: {
			if (!interaction.data) return;

			const cmd = commands.get(interaction.data.name);

			if (!cmd) {
				return logger.error("Command not found (why is the command registered...)");
			}

			const environment = await env(interaction.user.id.toString(), interaction.guildId?.toString());
			if (!environment) return;

			await interaction.defer(cmd.isPrivate ?? false);

			if (!(await manageCooldown(interaction, environment, cmd))) return;

			const options = new OptionResolver(interaction.data.options ?? [], interaction.data.resolved!);

			await cmd.interaction({ interaction, options, env: environment }).catch((err) => errorCallback(interaction, err));

			break;
		}
	}
};

export async function checkStatus(environment: Environment) {
	let status: keyof typeof NoCooldown | "plan" = "user";

	const hasVote = voted(environment.user);

	if (hasVote) status = "voter";

	const prem = await premium(environment);
	if (prem) status = prem.type;

	return status;
}

export function errorCallback(interaction: Interaction, err: NonNullable<unknown>) {
	interaction.bot.logger.error(`There was an error trying to execute the command ${interaction.data?.name}`);
	interaction.bot.logger.error("A detailed walkthrough is provided below.");
	interaction.bot.logger.error(err);
}

export async function manageCooldown(interaction: Interaction, environment: Environment, cmd: Command) {
	const status = await checkStatus(environment);

	if (status === "plan") return true;

	const hasCooldown = await checkCooldown(interaction.user.id, cmd, status);
	if (hasCooldown) {
		await interaction.edit({ embeds: hasCooldown });
		return;
	}

	return true;
}
