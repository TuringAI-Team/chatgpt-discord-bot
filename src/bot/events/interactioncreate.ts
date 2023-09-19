import { EventHandlers, InteractionTypes, logger } from "@discordeno/bot";
import { commands } from "../index.js";

export const interactionCreate: EventHandlers["interactionCreate"] = async (
	interaction,
) => {
	switch (interaction.type) {
		case InteractionTypes.ApplicationCommand: {
			if (!interaction.data) return;

			const cmd = commands.get(interaction.data.name);

			if (!cmd) {
				logger.error("Command not found (why is the command registered...)");
				return;
			}

			await interaction.defer(cmd.isPrivate ?? false);

			await cmd
				.execute({ interaction, bot: interaction.bot, env: {} })
				.catch((err) => {
					interaction.bot.logger.error(
						`There was an error trying to execute the command ${interaction.data?.name}`,
					);
					interaction.bot.logger.error(
						"A detailed walkthrough is provided below.",
					);
					interaction.bot.logger.error(err);
				});

			break;
		}

		default:
			break;
	}
};
