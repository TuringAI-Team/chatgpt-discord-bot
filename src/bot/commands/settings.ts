import { ApplicationCommandOptionTypes, calculatePermissions } from "discordeno";

import { SettingsCategories, buildSettingsPage, whichEntry } from "../settings.js";
import { SettingsLocation } from "../types/settings.js";
import { ResponseError } from "../error/response.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "settings",
	description: "...",

	options: {
		me: {
			type: ApplicationCommandOptionTypes.SubCommand,
			description: "Customize the bot for yourself"
		},

		server: {
			type: ApplicationCommandOptionTypes.SubCommand,
			description: "Customize the bot for the entire server"
		}
	},

	handler: async ({ interaction, options, env }) => {
		const location = options.me ? SettingsLocation.User : SettingsLocation.Guild;

		if (location === SettingsLocation.Guild && !env.guild) throw new ResponseError({
			message: "You can only view & change these settings on **servers**", emoji: "😔"
		});

		const permissions = interaction.member && interaction.member.permissions
			? calculatePermissions(interaction.member.permissions)
			: null;

		if (location === SettingsLocation.Guild && permissions && !permissions.includes("MANAGE_GUILD")) throw new ResponseError({
			message: "You must have the `Manage Server` permission to view & change these settings", emoji: "😔"
		});

		return buildSettingsPage(
			location, SettingsCategories[0], whichEntry(location, env)
		);
	}
});