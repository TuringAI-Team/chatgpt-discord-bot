import {
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	DiscordApplicationCommandOption,
	DiscordApplicationCommandOptionChoice,
	PermissionStrings,
} from "@discordeno/bot";
import { Command } from "../types/index.js";

export interface CreateCommand extends Omit<Command, "body"> {
	body: Omit<CommandConfig, "options"> & { options?: CustomOptionParser[] };
}

export function createCommand({ body, ...base }: CreateCommand): Command {
	const { options, ...info } = body;
	const payload: Command = { ...base, body: { ...info, type: ApplicationCommandTypes[body.type!] ?? ApplicationCommandTypes.ChatInput } };
	if (options) payload.body.options = optionsTranformer(options);
	return payload;
}

export type CustomChoices = [name: string, value?: string];

export function normalizeChoices(choices: CustomChoices[]): DiscordApplicationCommandOptionChoice[] {
	const result: DiscordApplicationCommandOptionChoice[] = [];
	for (let [name, value] of choices) {
		value ??= name.toLowerCase().trim().replace(/ +/, "");
		// get traduction
		result.push({ name, value });
	}

	return result;
}

export type CustomOption = Omit<DiscordApplicationCommandOption, "type"> & {
	type: keyof typeof ApplicationCommandOptionTypes;
};

export type CustomOptionParser = Omit<CustomOption, "description_localizations" | "name_localizations" | "choices" | "options"> & {
	choices?: CustomChoices[];
	options?: CustomOptionParser[];
};

export function optionsTranformer(options: CustomOptionParser[]): DiscordApplicationCommandOption[] {
	return options.map((option) => {
		const clone = {
			...option,
			type: ApplicationCommandOptionTypes[option.type],
		} as DiscordApplicationCommandOption;
		if (option.choices) clone.choices = normalizeChoices(option.choices);
		if (option.options) clone.options = optionsTranformer(option.options);
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
	type?: keyof typeof ApplicationCommandTypes;
	defaultMemberPermissions?: PermissionStrings[];
	dmPermission?: boolean;
	nsfw?: boolean;
	options?: ReturnType<typeof optionsTranformer>;
}

export const NoCooldown = { subscription: 0, user: 0, voter: 0 };
