import {
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	DiscordApplicationCommandOption,
	DiscordApplicationCommandOptionChoice,
	PermissionStrings,
} from "@discordeno/bot";

export type CustomChoices = [name: string, value?: string];

export function normalizeChoices(choices: CustomChoices[]): DiscordApplicationCommandOptionChoice[] {
	const result: DiscordApplicationCommandOptionChoice[] = [];
	for (let [name, value] of choices) {
		value ??= name.toLowerCase().trim().replace(/+s/, "");
		// get traduction
		result.push({ name, value });
	}

	return result;
}

export type CustomOption = Omit<DiscordApplicationCommandOption, "type"> & {
	type: keyof typeof ApplicationCommandOptionTypes;
};

export type CustomOptionParser = Omit<CustomOption, "description_localizations" | "name_localizations">;

export function optionsTranformer(options: CustomOptionParser[]): DiscordApplicationCommandOption[] {
	return options.map((option) => {
		const clone = {
			...option,
			type: ApplicationCommandOptionTypes[option.type],
		} as DiscordApplicationCommandOption;
		// get langs
		const factor = false;
		if (factor) {
			clone.name_localizations = {};
			clone.description_localizations = {};
		}
		return clone;
	});
}

export interface CommandConfig {
	name: string;
	description: string;
	type: keyof typeof ApplicationCommandTypes;
	defaultMemberPermissions?: PermissionStrings[];
	dmPermission?: boolean;
	nsfw?: boolean;
	options?: ReturnType<typeof optionsTranformer>;
}
