import {
	ApplicationCommandOptionTypes,
	ApplicationCommandTypes,
	ButtonStyles,
	DiscordApplicationCommandOption,
	DiscordApplicationCommandOptionChoice,
	DiscordButtonComponent,
	MessageComponentTypes,
	PermissionStrings,
} from "@discordeno/bot";
import config from "../../config.js";
import { Command } from "../types/index.js";

export interface CreateCommand extends Omit<Command, "body"> {
	body: Omit<CommandConfig, "options"> & { options?: CustomOptionParser[] };
}

export function createCommand({ body, ...base }: CreateCommand): Command {
	const { options, ...info } = body;
	const payload: Command = {
		...base,
		body: { ...info, type: ApplicationCommandTypes[body.type!] ?? ApplicationCommandTypes.ChatInput },
		pr: !!base.pr,
	};
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

export type ButtonNames = "invite" | "support" | "github";

export const buttonInfo: Record<ButtonNames, DiscordButtonComponent> = {
	invite: {
		type: MessageComponentTypes.Button,
		label: "Add me to your server",
		url: `https://discord.com/oauth2/authorize?client_id=${config.bot.id}&permissions=${config.bot.permissions}&scope=bot%20applications.commands`,
		style: ButtonStyles.Link,
	},
	support: {
		type: MessageComponentTypes.Button,
		label: "Support Server",
		url: `https://discord.gg/${config.brand.invite}`,
		style: ButtonStyles.Link,
	},
	github: {
		type: MessageComponentTypes.Button,
		label: "GitHub",
		url: `https://github.com/${config.repository}/tree/ddeno-new`,
		style: ButtonStyles.Link,
		emoji: {
			name: "github",
			id: "1097828013871222865",
		},
	},
};
