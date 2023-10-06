import { Guild } from "../../types/models/guilds.js";
import { User } from "../../types/models/users.js";
import { SettingCategory, SettingChoice, SettingOption, SettingsCategoryNames } from "../../types/settings.js";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export async function generateEmbed() {
	return null;
}

function getDefaultValues(settingId: string) {}

function getMetadata(settingId: string) {
	const isCategory = settingId.split(":").length === 1;
	if (isCategory) {
		switch (settingId) {
			case "chat":
				return {
					name: "Chat",
					description: "This is a chat",
					premium: false,
				};
			default:
				return {
					name: "Chat",
					description: "This is a setting",
					premium: false,
				};
		}
	} else {
		switch (settingId) {
			case "chat:tone":
				return {
					name: "Tone",
					description: "This is a tone",
					options: [""],
				};
			case "chat:model":
				return {
					name: "Model",
					description: "Which language model to use for chatting",
					options: [
						{
							name: "OpenChat",
							emoji: "<:openchat:1130816635402473563>",
							value: "openchat",
						},
					],
				};
			case "chat:partialMessages":
				return {
					name: "Partial Messages",
					description: "Whether chat messages by the bot should be shown while they're being generated",
					type: "boolean",
				};
			default:
				return {
					name: "Tone",
					description: "This is a setting",
					options: [""],
				};
		}
	}
}

export function getDefaultSettings(metadata: boolean) {
	let defaultUserSettings: SettingCategory[] = [
		{
			key: "chat",
			emoji: "💬",
			options: [
				{
					id: "chat:tone",
					key: "tone",
					value: "default",
					emoji: "🗣️",
				},
				{
					id: "chat:model",
					key: "model",
					value: "default",
					emoji: "🤖",
				},
				{
					id: "chat:partialMessages",
					key: "partialMessages",
					value: true,
					emoji: "⏳",
				},
			],
		},
	];
	if (metadata) {
		const defaultUserSettingsWithMetadata: SettingCategory[] = [];
		for (const category of defaultUserSettings) {
			const categoryMetadata = getMetadata(category.key);
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
				metadata: categoryMetadata,
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
			key: category as SettingsCategoryNames,
			emoji: "🔧",
			options: [],
		});
	}
	for (const settings of oldSettingsArray) {
		const categoryofSetting = settings[0].split(":")[0];
		const settingName = settings[0].split(":")[1];
		const settingValue = settings[1];
		const newCategory = newSettings.find((category) => category.key === categoryofSetting);
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
