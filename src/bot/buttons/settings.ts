import { ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";
import { EnabledSections, generateSections } from "../utils/settings.js";
import { env, premium } from "../utils/db.js";

export const settings: ButtonResponse = {
	id: "settings",
	args: ["action", "value"],
	isPrivate: false,
	run: async (interaction, data) => {
		const environment = await env(interaction.user.id.toString(), interaction.guildId?.toString());
		const prem = await premium(environment);
		switch (data.action) {
			case "open": {
				const page = EnabledSections[0];
				const section = await generateSections(page, environment);
				if (section) {
					await interaction.edit(section);
				} else {
					await interaction.edit({
						content: "No section found",
					});
				}
				break;
			}
			case "update":
				const id = data.value;
				console.log(interaction.data);
				const newValue = interaction.data;
				await interaction.edit({
					content: "Updated",
				});
				break;
			default:
				await interaction.edit({
					content: "No action found",
				});
		}
	},
};

export default settings;
