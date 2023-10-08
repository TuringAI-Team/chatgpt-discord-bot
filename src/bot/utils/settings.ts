import { Guild } from "../../types/models/guilds.js";
import { LOADING_INDICATORS, USER_LANGUAGES, User } from "../../types/models/users.js";
import { SettingCategory, SettingChoice, SettingOption, SettingsCategoryNames } from "../../types/settings.js";
import { CHAT_MODELS } from "../models/index.js";
import { TONES } from "../models/tones/index.js";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export async function generateEmbed() {
	return null;
}

function getDefaultValues(settingId: string) {}

function getMetadata(settingId: string) {
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
			};
		case "chat:model":
			return {
				name: "Model",
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
				description: "Whether chat messages by the bot should be shown while they're being generated",
				type: "boolean",
			};
		case "image:model":
			return {
				name: "Model",
				description: "Which AI model to use for image generation",
				options: [],
			};
		default:
			return {
				name: "Tone",
				description: "This is a setting",
				options: [""],
			};
	}
}

export function getDefaultSettings(metadata: boolean) {
	let defaultUserSettings: SettingCategory[] = [
		{
			name: "general",
			emoji: "🧭",
			options: [
				{
					id: "general:language",
					key: "language",
					value: "en",
					emoji: "🌐",
				},
				{
					id: "general:loadingIndicator",
					key: "loadingIndicator",
					value: "default",
					emoji: "🔄",
				},
			],
		},
		{
			name: "chat",
			emoji: "💬",
			options: [
				{
					id: "chat:model",
					key: "model",
					value: "default",
					emoji: "🤖",
				},
				{
					id: "chat:tone",
					key: "tone",
					value: "default",
					emoji: "🗣️",
				},

				{
					id: "chat:partialMessages",
					key: "partialMessages",
					value: true,
					emoji: "⏳",
				},
			],
		},
		{
			name: "image",
			emoji: "🖼️",
			options: [
				{
					id: "image:model",
					key: "model",
					value: "default",
					emoji: "🤖",
				},
				{
					id: "image:style",
					key: "style",
					value: "default",
					emoji: "🎨",
				},
			],
		},
		{
			name: "premium",
			emoji: "💎",
			options: [
				{
					id: "image:typePriority",
					key: "typePriority",
					value: "plan",
					emoji: "✨",
				},
				{
					id: "premium:locationPriority",
					key: "locationPriority",
					value: "guild",
					emoji: "✨",
				},
			],
		},
	];
	if (metadata) {
		const defaultUserSettingsWithMetadata: SettingCategory[] = [];
		for (const category of defaultUserSettings) {
			const OptionsWithMetadata: SettingOption[] = [];
			for (const option of category.options) {
				const optionMetadata = getMetadata(option.id);
				if (!optionMetadata.options) return;
				const newOption: SettingOption = {
					...option,
					metadata: optionMetadata,
				};
				OptionsWithMetadata.push(newOption);
			}
			category.options = [];
			const newCategory = {
				...category,
				options: OptionsWithMetadata,
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
			emoji: "🔧",
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
			emoji: "🔧",
		});
	}
	console.log(JSON.stringify(newSettings, null, 2));
}

export function getSettingsValue(entry: Guild | User, key: string): string | number | boolean | object {
	if (!entry || !entry.settings_new) return false;
	const { collection, id } = key2data(key);
	const category = entry.settings_new.find((category) => category.name === collection);
	if (!category) return false;
	// @ts-expect-error idk
	const option = category.options.find((option) => option.id === id);
	if (!option) return false;
	return option.value;
}
