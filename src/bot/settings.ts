import { ActionRow, ButtonComponent, ButtonStyles, MessageComponentTypes, SelectMenuComponent } from "discordeno";
import { randomUUID } from "crypto";

import { SettingsCategory, SettingsLocation, SettingsOption, SettingsOptionType } from "./types/settings.js";

import type { InteractionHandlerOptions } from "./types/interaction.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";

import { LOADING_INDICATORS, USER_LANGUAGES } from "../db/types/user.js";
import { EmbedColor, type MessageResponse } from "./utils/response.js";
import { canUse, restrictionTypes } from "./utils/restriction.js";
import { CHAT_MODELS } from "./chat/models/mod.js";
import { IMAGE_MODELS } from "./image/models.js";
import { IMAGE_STYLES } from "./image/styles.js";
import { TONES } from "./chat/tones/mod.js";

export const SettingsCategories: SettingsCategory[] = [
	{
		name: "General",
		emoji: "🧭",

		options: [
			{
				name: "Language",
				description: "Primary language to use for the bot",
				emoji: "🌐", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "en-US",
				
				choices: USER_LANGUAGES.map(l => ({
					name: l.name, emoji: l.emoji, value: l.id
				}))
			},

			{
				name: "Loading indicator",
				description: "Which emoji to use throughout the bot to indicating loading",
				emoji: "🔄", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: LOADING_INDICATORS[0].emoji.id.toString(),
				
				choices: LOADING_INDICATORS.map(l => ({
					name: l.name, emoji: l.emoji, value: l.emoji.id.toString()
				}))
			}
		]
	},

	{
		name: "Chat",
		emoji: "🗨️",

		options: [
			{
				name: "Model",
				description: "Which AI language model to use for chatting",
				emoji: "🤖", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "chatgpt",
				
				choices: CHAT_MODELS.map(m => ({
					name: m.name, description: m.description, emoji: m.emoji, restrictions: m.restrictions, value: m.id
				}))
			},

			{
				name: "Tone",
				description: "Which tone the AI language model should have",
				emoji: "😊", type: SettingsOptionType.Choices,
				location: SettingsLocation.User,
				default: "neutral",
				
				choices: TONES.map(t => ({
					name: t.name, description: t.description, emoji: t.emoji, value: t.id
				}))
			},

			{
				name: "Partial messages",
				description: "Whether chat messages by the bot should be shown while they're being generated",
				emoji: "⏳", default: true,
				type: SettingsOptionType.Boolean,
				location: SettingsLocation.User
			}
		]
	},

	{
		name: "Image",
		emoji: "🖼️",
		
		options: [
			{
				name: "Model", emoji: "🖼️",
				description: "Which image generation model to use",
				location: SettingsLocation.User, default: "kandinsky",
				type: SettingsOptionType.Choices,

				choices: IMAGE_MODELS.map(m => ({
					name: m.name, value: m.id
				}))
			},

			{
				name: "Style", emoji: "🖌️",
				description: "Which image style to use",
				location: SettingsLocation.User, default: "none",
				type: SettingsOptionType.Choices,

				choices: IMAGE_STYLES.map(m => ({
					name: m.name, emoji: m.emoji, value: m.id
				}))
			},
		]
	},

	{
		name: "Premium",
		emoji: "✨",
		
		options: [
			{
				name: "Type priority", emoji: "✨",
				description: "Which premium type to prioritize",
				location: SettingsLocation.Both, default: "plan",
				type: SettingsOptionType.Choices,

				choices: [
					{
						name: "Pay-as-you-go", emoji: "📊", value: "plan",
						description: "Use the credit-based pay-as-you-go plan first"
					},
		
					{
						name: "Subscription", emoji: "💸", value: "subscription",
						description: "Use the fixed subscription first"
					}
				]
			},

			{
				name: "Location priority", emoji: "✨",
				description: "Whether to prioritize your own or the server's Premium",
				location: SettingsLocation.Both, default: "guild",
				type: SettingsOptionType.Choices,

				choices: [
					{
						name: "The server's Premium", emoji: "☎️", value: "guild",
						description: "Use the server's Premium before using your own"
					},
		
					{
						name: "My own Premium", emoji: "👤", value: "user",
						description: "Always use your own Premium, not regarding whether the server has Premium or not"
					}
				]
			}
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

export function getSettingsValue<T = string | number | boolean>(entry: DBGuild | DBUser, key: string): T {
	const option = getOption(key);
	return entry.settings[key] as T ?? option.default;
}

export async function handleSettingsInteraction({ bot, args, env, interaction }: InteractionHandlerOptions) {
	const action: "page" | "current" | "change" | "view" = args.shift()! as any;
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
			const choice = option.choices.find(c => c.value === newValue)!;

			if (choice.restrictions && !canUse(bot, env, choice.restrictions)) {
				const allowed = restrictionTypes(choice.restrictions);

				return void await interaction.reply({
					embeds: {
						description: `The choice ${choice.name} is ${allowed.map(a => `**${a.description}** ${a.emoji}`).join(", ")}.`,
						color: EmbedColor.Orange
					},
		
					ephemeral: true
				});
			}
		}

		if (newValue !== null) {
			settings[key] = newValue;

			entry = await bot.db.update<DBGuild | DBUser>(
				location === SettingsLocation.Guild ? "guilds" : "users", entry,
				{ settings: { ...settings,[key]: newValue } }
			);

		}

	/* View a specific settings category */
	} else if (action === "view") {
		return void await interaction.reply(
			buildSettingsPage(location, category, entry)
		);
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

			options: option.choices.map(c => {
				const restrictions = c.restrictions ? restrictionTypes(c.restrictions) : [];

				return ({
					label: `${c.name} ${restrictions.map(r => r.emoji).join(" ")}`, value: c.value,
					description: c.restrictions
						? `${c.description ?? ""} (${restrictions.map(r => r.description).join(", ")})`
						: c.description,
					emoji: c.emoji ? typeof c.emoji === "string" ? { name: c.emoji } : c.emoji : undefined,
					default: c.value === current
				});
			})
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
			label: category.name, emoji: typeof category.emoji === "string" ? { name: category.emoji } : category.emoji,
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