import { Guild } from "../../types/models/guilds.js";
import { LOADING_INDICATORS, USER_LANGUAGES, User } from "../../types/models/users.js";
import { SettingCategory, SettingCategoryMetadata, SettingChoice, SettingOption, SettingOptionMetadata, SettingsCategoryNames } from "../../types/settings.js";
import { CHAT_MODELS } from "../models/index.js";
import { STYLES } from "../models/styles/index.js";
import { TONES } from "../models/tones/index.js";
import { update } from "./db.js";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export async function generateEmbed() {
	return null;
}

function getDefaultValues(settingId: string) { }

function getMetadata(settingId: string, type: "setting" | "category"): SettingOptionMetadata | SettingCategoryMetadata | undefined {
	if (type == "setting") {
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
					options: CHAT_MODELS.map((m) => ({
						name: m.name,
						emoji: `<${m.emoji.name}:${m.emoji.id}>`,
						value: m.id,
					})),
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
					]

				}
			default:
				return {
					name: "Tone",
					description: "This is a setting",
					options: [""],
					emoji: "🗣️",
				};
		}
	} else if (type == "category") {
		switch (settingId) {
			case "general":
				return {
					name: "General",
					emoji: "🧭",
					premium: false,
					description: "General settings",
				};
			case "chat":
				return {
					name: "Chat",
					emoji: "💬",
					premium: false,
					description: "Chat settings",
				};
			case "image":
				return {
					name: "Image",
					emoji: "🖼️",
					premium: false,
					description: "Image settings",
				};
			case "premium":
				return {
					name: "Premium",
					emoji: "💎",
					premium: true,
					description: "Premium settings",
				};
			default:
				return {
					name: "General",
					emoji: "🧭",
					premium: false,
					description: "General settings",
				};

		}
	}
}

export function getDefaultSettings(metadata: boolean) {
	let defaultUserSettings: SettingCategory[] = [
		{
			name: "general",
			options: [
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
			options: [
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
			options: [
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
			options: [
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
			const OptionsWithMetadata: SettingOption[] = [];
			for (const option of category.options) {
				const optionMetadata = getMetadata(option.id, "setting") as SettingOptionMetadata;
				if (!optionMetadata.options) return;
				const newOption: SettingOption = {
					...option,
					metadata: optionMetadata,
				};
				OptionsWithMetadata.push(newOption);
			}
			category.options = [];
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
	console.log(JSON.stringify(defaultUserSettings, null, 2));
	return defaultUserSettings;
}

export async function oldSettingsMigration(entry: Guild | User) {
	if (entry.settings_new.length >= 1) return;
	const oldSettings = entry.settings;
	if (!oldSettings) return;
	const newSettings: Array<SettingCategory> = [];
	const oldSettingsArray = Object.entries(oldSettings);
	const oldSettingsCategories = oldSettingsArray
		.map((setting) => setting[0].split(":")[0])
		.filter((value, index, self) => self.indexOf(value) === index);
	for (const category of oldSettingsCategories) {
		newSettings.push({
			name: category as SettingsCategoryNames,
			options: [],
		});
	}
	for (const settings of oldSettingsArray) {
		const categoryofSetting = settings[0].split(":")[0];
		const settingName = settings[0].split(":")[1];
		const settingValue = settings[1];
		const newCategory = newSettings.find((category) => category.name === categoryofSetting);
		if (!newCategory) continue;
		newCategory.options.push({
			id: settings[0],
			key: settingName,
			value: settingValue,
		});
	}
	return newSettings;
}

export async function getSettingsValue(entry: Guild | User, key: string): Promise<string | number | boolean | object> {
	let entryType: "users" | "guilds";
	if (!entry) return false;
	if ("roles" in entry) entryType = "users";
	else entryType = "guilds";

	if (!entry || !entry.settings_new) {
		let newSettings = await oldSettingsMigration(entry);
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

	const option = category.options.find((option: { id: string }) => option.id === id);
	if (!option) return false;
	return option.value;
}
