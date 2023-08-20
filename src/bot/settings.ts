import { ActionRow, ButtonComponent, ButtonStyles, MessageComponentTypes, SelectMenuComponent } from "discordeno";
import { randomUUID } from "crypto";

import { SettingsCategory, SettingsLocation, SettingsOption, SettingsOptionType } from "./types/settings.js";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { MessageResponse } from "./utils/response.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

export const SettingsCategories: SettingsCategory[] = [
	{
		name: "General",
		emoji: "🧭",

		options: [
			{
				name: "Partial messages",
				description: "Whether chat messages by the bot should be shown while they're being generated",
				emoji: "⏳", default: true,
				type: SettingsOptionType.Boolean
			}

			/* TODO: Add all other settings */
		]
	}
];

function categoryKey(category: SettingsCategory) {
	return category.name.toLowerCase().replaceAll(" ", "_");
}

function optionKey(option: SettingsOption) {
	return option.name.toLowerCase().replaceAll(" ", "_");
}

function categoryOptionKey(category: SettingsCategory, option: SettingsOption): `${string}:${string}` {
	return `${categoryKey(category)}:${optionKey(option)}`;
}

export function whichEntry(location: SettingsLocation, env: DBEnvironment) {
	return location === SettingsLocation.Guild
		? env.guild! : env.user;
}

function getOption(key: string): SettingsOption {
	const [ categoryName, optionName ] = key.split(":");

	const category = SettingsCategories.find(c => categoryKey(c) === categoryName)!;
	const option = category.options.find(o => optionKey(o) === optionName)!;

	return option;
}

function getSettingsValue<T = string | number | boolean>(entry: DBGuild | DBUser, key: string): T {
	const option = getOption(key);
	return entry.settings[key] as T ?? option.default;
}

export async function handleSettingsInteraction({ bot, args, env, interaction }: InteractionHandlerOptions) {
	const action: "page" | "current" | "change" = args.shift()! as any;
	const location: SettingsLocation = args.shift()! as SettingsLocation;

	const categoryName = args.shift()!;
	const category = SettingsCategories.find(c => categoryKey(c) === categoryName)!;

	let entry = whichEntry(location, env);
	const settings = entry.settings;

	/* Change the page */
	if (action === "page") {
		/* Current category index */
		const currentIndex = SettingsCategories.findIndex(c => c.name === category.name);

		/* How to switch the pages, either -1 or (+)1 */
		const delta = parseInt(args[0]);

		/* Which category to switch to */
		const newCategory = SettingsCategories[currentIndex + delta];
		if (!newCategory) return;

		return void await interaction.update(
			buildSettingsPage(
				location, newCategory, entry
			)
		);

	/** Update a setting value */
	} else if (action === "change") {
		/* Which option to update */
		const option = category.options.find(o => optionKey(o) === args[0]);
		if (!option) return;

		const key = categoryOptionKey(category, option);

		const currentValue = getSettingsValue(entry, key);
		let newValue: string | number | boolean | null = null;

		if (option.type === SettingsOptionType.Boolean) {
			newValue = !currentValue;

		} else if (option.type === SettingsOptionType.Choices) {
			newValue = interaction.data?.values?.[0] ?? currentValue;
		}

		if (newValue !== null) {
			settings[key] = newValue;

			entry = await bot.db.update<DBGuild | DBUser>(
				location === SettingsLocation.Guild ? "guilds" : "users", entry,

				{
					settings: {
						...settings,[key]: newValue
					}
				}
			);

		}
	}

	await interaction.update(
		buildSettingsPage(location, category, entry)
	);
}

export function buildSettingsPage(
	location: SettingsLocation, category: SettingsCategory, entry: DBUser | DBGuild
): MessageResponse {
	const rows: ActionRow[] = [];

	for (const option of category.options.filter(
		o => o.location && o.location !== SettingsLocation.Both ? o.location === location : true
	)) {
		const value = getSettingsValue(entry, categoryOptionKey(category, option));
		rows.push(buildOption(location, category, option, value));
	}

	rows.push(buildPageSwitcher(location, category));

	return {
		components: rows, ephemeral: true
	};
}

function buildOption(
	location: SettingsLocation, category: SettingsCategory, option: SettingsOption, current: string | number | boolean
): ActionRow {
	const components: (SelectMenuComponent | ButtonComponent)[] = [];

	if (option.type === SettingsOptionType.Boolean) {
		components.push(
			{
				type: MessageComponentTypes.Button,
				label: option.name, emoji: { name: option.emoji },
				style: ButtonStyles.Secondary, disabled: true,
				customId: randomUUID()
			},

			{
				type: MessageComponentTypes.Button,
				label: undefined!, emoji: { name: "🔘" },
				style: current ?  ButtonStyles.Success : ButtonStyles.Secondary,
				customId: `settings:change:${location}:${categoryOptionKey(category, option)}`
			}
		);

	} else if (option.type === SettingsOptionType.Choices) {
		components.push({
			type: MessageComponentTypes.SelectMenu,
			customId: `settings:change:${location}:${categoryOptionKey(category, option)}`,

			placeholder: `${option.name} ${option.emoji}`,

			options: option.choices.map(c => ({
				label: c.name, value: c.value,
				description: c.description,
				emoji: c.emoji ? { name: c.emoji } : undefined,
				default: c.value === current
			}))
		});
	}
	return {
		type: MessageComponentTypes.ActionRow,
		components: components as [ ButtonComponent ]
	};
}

function buildPageSwitcher(location: SettingsLocation, category: SettingsCategory): ActionRow {
	const currentIndex = SettingsCategories.findIndex(c => c.name === category.name);

	const components: [ ButtonComponent, ButtonComponent, ButtonComponent ] = [
		{
			type: MessageComponentTypes.Button,
			label: undefined!, emoji: { name: "◀️" },
			style: ButtonStyles.Secondary,
			customId: `settings:page:${location}:${categoryKey(category)}:-1`,
			disabled: currentIndex - 1 < 0
		},

		{
			type: MessageComponentTypes.Button,
			label: category.name, emoji: { name: category.emoji },
			style: ButtonStyles.Success,
			customId: `settings:current:${location}:${categoryKey(category)}`
		},

		{
			type: MessageComponentTypes.Button,
			label: undefined!, emoji: { name: "▶️" },
			style: ButtonStyles.Secondary,
			customId: `settings:page:${location}:${categoryKey(category)}:1`,
			disabled:  currentIndex + 1 > SettingsCategories.length - 1
		},
	];

	return {
		type: MessageComponentTypes.ActionRow,
		components
	};
}