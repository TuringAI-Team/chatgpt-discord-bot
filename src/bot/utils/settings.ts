import { Guild } from "../../types/models/guilds.js";
import { LOADING_INDICATORS, USER_LANGUAGES, User } from "../../types/models/users.js";
import { Environment } from "../../types/other.js";
import {
	Setting,
	SettingCategory,
	SettingCategoryMetadata,
	SettingMetadata,
	SettingOption,
	SettingsCategoryNames,
} from "../../types/settings.js";
import { CHAT_MODELS, ChatModel } from "../models/index.js";
import { STYLES } from "../models/styles/index.js";
import { TONES } from "../models/tones/index.js";
import { supabase, update } from "./db.js";
import {
	MessageComponentTypes,
	ButtonComponent,
	DiscordEmbed,
	CreateMessageOptions,
	MessageComponents,
	DiscordEmbedField,
	ButtonStyles,
	SelectMenuComponent,
} from "@discordeno/bot";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export type EnabledSectionsTypes = "chat" | "image" | "premium" | string;
export const EnabledSections: Array<EnabledSectionsTypes> = ["chat"];
export async function generateSections(pageName: EnabledSectionsTypes, env: Environment): Promise<CreateMessageOptions | null> {
	let message: null | CreateMessageOptions = null;
	const user = env.user;
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
	const settingsWithMetadata = await getSettingsMetadata(settings);
	console.log(settingsWithMetadata);
	if (!settingsWithMetadata) return null;
	const sectionSettings = settingsWithMetadata.find((category) => category.name === pageName);
	let settingsComponents =
		sectionSettings?.settings.map((setting) => {
			if (setting.metadata) {
				if (setting.metadata.options) {
					return {
						type: MessageComponentTypes.SelectMenu,
						customId: setting.id,
						options: setting.metadata.options.map((option) => ({
							label: option.name,
							value: option.value.toString(),
							default: option.value === setting.value,
							description: option.description,
							emoji:
								option.emoji &&
								({
									name: option.emoji,
								} as string | { name: string; id: string }),
						})),
						placeholder: `${setting.metadata.emoji} ${setting.metadata.name}`,
						disabled: !setting.metadata.enabled,
					} as SelectMenuComponent;
				} else if (setting.metadata.type === "boolean") {
					return {
						type: MessageComponentTypes.SelectMenu,
						customId: setting.id,
						options: [
							{
								label: "Enabled",
								value: "true",
								default: setting.value === true,
								description: "Enable this setting",
								emoji: {
									name: "✅",
								},
							},
							{
								label: "Disabled",
								value: "false",
								default: setting.value === false,
								description: "Disable this setting",
								emoji: {
									name: "❌",
								},
							},
						],
						disabled: !setting.metadata.enabled,
						placeholder: `${setting.metadata.emoji} ${setting.metadata.name}`,
					} as SelectMenuComponent;
				}
			}
		}) || [];
	settingsComponents = settingsComponents.filter((setting) => setting !== undefined) as SelectMenuComponent[];
	const settingsRows: MessageComponents = [];
	for (let i = 0; i < settingsComponents.length; i++) {
		const component = settingsComponents[i];
		if (component) {
			settingsRows.push({
				type: MessageComponentTypes.ActionRow,
				components: [component],
			});
		}
	}
	message = {
		content: "",
		components: [
			...settingsRows,
			{
				type: MessageComponentTypes.ActionRow,
				components: [
					{
						type: MessageComponentTypes.SelectMenu,
						customId: "settings_open",
						options: settingsWithMetadata.map((category) => ({
							label: category.metadata?.name || category.name,
							value: category.metadata?.name || category.name.toLowerCase(),
							default: category.metadata?.name === sectionSettings?.metadata?.name,
							description: category.metadata?.description,
							emoji: {
								name: category.metadata?.emoji || "",
							},
							disabled: EnabledSections.includes(category.name) ? false : true,
						})),
					},
				],
			},
		],
	};

	return message;
}

function getDefaultValues(settingId: string) {}

export function getMetadata(settingId: string, type: "setting" | "category"): SettingMetadata;
export function getMetadata(settingId: keyof typeof Categories, type: "setting" | "category"): SettingCategoryMetadata;
export function getMetadata(
	settingId: string | keyof typeof Categories,
	type: "setting" | "category",
): SettingMetadata | SettingCategoryMetadata | undefined {
	if (type === "setting") {
		switch (settingId) {
			case "general:language":
				return {
					name: "Language",
					description: "Primary language to use for the bot",
					options: USER_LANGUAGES.map((l) => ({
						name: l.name,
						emoji: l.emoji,
						value: l.id,
					})),
					emoji: "🌐",
				};
			case "general:loadingIndicator":
				return {
					name: "Loading Indicator",
					description: "Which emoji to use throughout the bot to indicating loading",
					options: LOADING_INDICATORS.map((l) => ({
						name: l.name,
						emoji: `<${l.emoji.name}:${l.emoji.id}>`,
						value: l.emoji?.id || "default",
					})),
					emoji: "🔄",
				};
			case "chat:model":
				return {
					name: "Model",
					emoji: "🤖",
					description: "Which language model to use for chatting",
					options: CHAT_MODELS.map((m: ChatModel) => ({
						name: m.name,
						emoji: `<${m.emoji.name}:${m.emoji.id}>`,
						value: m.id,
					})),
					enabled: true,
				};
			case "chat:tone":
				return {
					name: "Tone",
					emoji: "🗣️",
					description: "Which tone the AI language model should have",
					options: TONES.map((t) => ({
						name: t.name,
						emoji: `${t.emoji}`,
						value: t.id,
					})),
				};
			case "chat:partialMessages":
				return {
					name: "Partial Messages",
					emoji: "⏳",
					description: "Whether chat messages by the bot should be shown while they're being generated",
					type: "boolean",
				};
			case "image:model":
				return {
					name: "Model",
					emoji: "🤖",
					description: "Which AI model to use for image generation",
					options: [],
				};
			case "image:style":
				return {
					name: "Style",
					emoji: "🎨",
					description: "Which style to use for image generation",
					options: STYLES.map((s) => ({
						name: s.name,
						emoji: `${s.emoji}`,
						value: s.id,
					})),
				};
			case "premium:typePriority":
				return {
					name: "Type Priority",
					emoji: "✨",
					description: "Which type of premium should be prioritized",
					options: [
						{
							name: "Plan",
							emoji: "📅",
							value: "plan",
						},
						{
							name: "Subscription",
							emoji: "🔔",
							value: "subscription",
						},
					],
				};
			case "premium:locationPriority":
				return {
					name: "Location Priority",
					emoji: "✨",
					description: "Which location of premium should be prioritized",
					options: [
						{
							name: "Guild",
							emoji: "🏰",
							value: "guild",
						},
						{
							name: "User",
							emoji: "👤",
							value: "user",
						},
					],
				};
			default:
				return {
					name: "Tone",
					description: "This is a setting",
					options: [],
					emoji: "🗣️",
				};
		}
	} else if (type === "category") {
		return Categories[settingId as keyof typeof Categories] ?? Categories.general;
	}
}

export const Categories = {
	general: {
		name: "General",
		emoji: "🧭",
		premium: false,
		description: "General settings",
	},
	chat: {
		name: "Chat",
		emoji: "💬",
		premium: false,
		description: "Chat settings",
	},
	image: {
		name: "Image",
		emoji: "🖼️",
		premium: false,
		description: "Image settings",
	},
	plugins: {
		name: "Plugins",
		emoji: "🧩",
		premium: false,
		description: "Plugin settings",
	},
	premium: {
		name: "Premium",
		emoji: "💎",
		premium: true,
		description: "Premium settings",
	},
	limits: {
		name: "Limits",
		emoji: "📏",
		premium: false,
		description: "Limit settings",
	},
};

async function getSettingsMetadata(settings: SettingCategory[]) {
	const UserSettingsWithMetadata: SettingCategory[] = [];
	for (const category of settings) {
		const SettingsWithMetadata: Setting[] = [];
		for (const setting of category.settings) {
			const settingMetadata = getMetadata(setting.id, "setting") as SettingMetadata;
			if (!settingMetadata.options) return;
			const newOption: Setting = {
				...setting,
				metadata: settingMetadata,
			};
			SettingsWithMetadata.push(newOption);
		}
		category.settings = SettingsWithMetadata;
		const categoryMetadata = getMetadata(category.name, "category") as SettingCategoryMetadata;
		const newCategory = {
			...category,
			metadata: categoryMetadata,
		};
		UserSettingsWithMetadata.push(newCategory);
	}
	console.log(UserSettingsWithMetadata);
	return UserSettingsWithMetadata;
}

// this returns  the default settings for creating a new user
export function getDefaultUserSettings(metadata: boolean) {
	let defaultUserSettings: SettingCategory[] = [
		{
			name: "general",
			settings: [
				{
					id: "general:language",
					key: "language",
					value: "en",
				},
				{
					id: "general:loadingIndicator",
					key: "loadingIndicator",
					value: "default",
				},
			],
		},
		{
			name: "chat",
			settings: [
				{
					id: "chat:model",
					key: "model",
					value: "default",
				},
				{
					id: "chat:tone",
					key: "tone",
					value: "default",
				},

				{
					id: "chat:partialMessages",
					key: "partialMessages",
					value: true,
				},
			],
		},
		{
			name: "image",
			settings: [
				{
					id: "image:model",
					key: "model",
					value: "default",
				},
				{
					id: "image:style",
					key: "style",
					value: "default",
				},
			],
		},
		{
			name: "premium",
			settings: [
				{
					id: "premium:typePriority",
					key: "typePriority",
					value: "plan",
				},
				{
					id: "premium:locationPriority",
					key: "locationPriority",
					value: "guild",
				},
			],
		},
	];
	if (metadata) {
		const defaultUserSettingsWithMetadata: SettingCategory[] = [];
		for (const category of defaultUserSettings) {
			const OptionsWithMetadata: Setting[] = [];
			for (const option of category.settings) {
				const optionMetadata = getMetadata(option.id, "setting") as SettingMetadata;
				if (!optionMetadata.options) return;
				const newOption: Setting = {
					...option,
					metadata: optionMetadata,
				};
				OptionsWithMetadata.push(newOption);
			}
			category.settings = [];
			const categoryMetadata = getMetadata(category.name, "category") as SettingCategoryMetadata;
			const newCategory = {
				...category,
				options: OptionsWithMetadata,
				metadata: categoryMetadata,
			};
			defaultUserSettingsWithMetadata.push(newCategory);
		}
		defaultUserSettings = defaultUserSettingsWithMetadata;
	}

	return defaultUserSettings;
}

// this returns  the new  settings for migrating from the old settings
export async function oldSettingsMigration(oldSettings: {
	[key: string]: string | number | boolean | object | Array<string | number | boolean>;
}) {
	if (!oldSettings) return;
	const newSettings: Array<SettingCategory> = [];
	const oldSettingsArray = Object.entries(oldSettings);
	const oldSettingsCategories = oldSettingsArray
		.map((setting) => setting[0].split(":")[0])
		.filter((value, index, self) => self.indexOf(value) === index);
	for (const category of oldSettingsCategories) {
		newSettings.push({
			name: category as SettingsCategoryNames,
			settings: [],
		});
	}
	for (const setting of oldSettingsArray) {
		const categoryofSetting = setting[0].split(":")[0];
		const settingName = setting[0].split(":")[1];
		const settingValue = setting[1];
		const newCategory = newSettings.find((category) => category.name === categoryofSetting);
		if (!newCategory) continue;
		newCategory.settings.push({
			id: setting[0],
			key: settingName,
			value: settingValue,
		});
	}
	return newSettings;
}

export async function oldSettingsMigrationBulk() {
	//  there are 540k users do your thing
	const pages = 567;
	for (let i = 0; i < pages; i++) {
		const usersPerPage = 1;
		const { data, error } = await supabase
			.from("users_new")
			.select("*")
			.range(i * usersPerPage, (i + 1) * usersPerPage - 1);
		if (error) return console.error(error);
		if (data) {
			// do a bulk update
			const upsertInfo = [];
			for (const user of data) {
				const newSettings = await oldSettingsMigration(user.settings);
				if (newSettings) {
					const newsettings = {
						id: user.id,
						settings_new: newSettings,
					};
					upsertInfo.push(newsettings);
				}
			}
			return;
			//		await supabase.from("users_new").upsert(upsertInfo);
		}
	}
}

// get the value of a specific setting
export async function getSettingsValue(entry: Guild | User, key: string): Promise<string | number | boolean | object> {
	let entryType: "users" | "guilds";
	if (!entry) return false;
	if ("roles" in entry) entryType = "users";
	else entryType = "guilds";

	if (!entry || !entry.settings_new) {
		const newSettings = await oldSettingsMigration(entry.settings);
		if (newSettings) {
			entry.settings_new = newSettings;
			await update(entryType, entry.id, {
				settings_new: newSettings,
			});
		} else {
			return false;
		}
		return false;
	}
	const { collection, id } = key2data(key);
	const category = entry.settings_new.find((category) => category.name === collection);
	if (!category) return false;

	const option = category.settings.find((option: { id: string }) => option.id === id);
	if (!option) return false;
	return option.value;
}
