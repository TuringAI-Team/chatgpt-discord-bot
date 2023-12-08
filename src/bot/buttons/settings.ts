import { ButtonComponent, ButtonStyles, CreateMessageOptions, InteractionResponseTypes, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";
import { EnabledSections, EnabledSectionsTypes, generateSections, oldSettingsMigration } from "../utils/settings.js";
import { env, premium, update } from "../utils/db.js";
import { SettingsCategoryNames } from "../../types/settings.js";
import { Environment } from "../../types/other.js";
import config from "../../config.js";
import { requiredPremium } from "../utils/premium.js";

export const settings: ButtonResponse = {
	id: "settings",
	args: ["action", "value"],
	isPrivate: true,
	deferType: InteractionResponseTypes.DeferredChannelMessageWithSource,
	run: async (interaction, data) => {
		const environment = await env(interaction.user.id.toString(), interaction.guildId?.toString());
		const prem = await premium(environment);
		switch (data.action) {
			case "open": {
				let page = EnabledSections[0];
				const newValue = interaction.data.values?.[0];
				if (newValue) {
					page = newValue.toLowerCase() as EnabledSectionsTypes;
				}
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
				const prem = await premium(environment);
				const categoryId = id.split(":")[0] as SettingsCategoryNames;
				let newValue = interaction.data.values?.[0];
				const isPremium = newValue?.includes("_premium");
				if (isPremium) {
					newValue = newValue?.replace("_premium", "");
				}
				if (!prem && isPremium) {
					await interaction.edit(requiredPremium as CreateMessageOptions);
					return;
				}

				const user = environment.user;
				let settings = user.settings_new;
				if (!settings || settings.length === 0) {
					const newSettings = await oldSettingsMigration(user.settings);
					if (newSettings) {
						settings = newSettings;
						await update("users", user.id, {
							settings_new: newSettings,
						});
					}
				}
				const newSettings = settings?.map((x) => {
					if (x.name === categoryId) {
						return {
							...x,
							settings: x.settings.map((y) => {
								if (y.id === id) {
									return {
										id: y.id,
										key: y.key,
										value: newValue,
									};
								} else {
									return y;
								}
							}),
						};
					} else {
						return x;
					}
				});
				await update("users", user.id, {
					settings_new: newSettings,
				});
				const newEnvironment = {
					...environment,
					user: {
						...user,
						settings_new: newSettings,
					},
				} as Environment;

				const section = await generateSections(categoryId, newEnvironment);
				if (section) {
					await interaction.edit(section);
				} else {
					await interaction.edit({
						content: "No section found",
					});
				}
				break;
			default:
				await interaction.edit({
					content: "No action found",
				});
		}
	},
};

export default settings;
