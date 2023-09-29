import { Guild } from "../../types/models/guilds.js";
import { User } from "../../types/models/users.js";
import { SettingCategory, SettingChoice } from "../../types/settings.js";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export async function oldSettingsMigration(entry: Guild | User) {
	if (entry.settings_new.length >= 1) return;
	const oldSettings = entry.settings;
	if (!oldSettings) return;
	const newSettings: Array<SettingCategory> = [];
	const oldSettingsArray = Object.entries(oldSettings);
	for (let i = 0; i < oldSettingsArray.length; i++) {
		const category = oldSettingsArray[i];
		const newCategory = {
			name: category[0],
			emoji: "🔧",
			options: [],
		};
		if (newSettings.find((category) => category.name === newCategory.name)) {
			// update options

			continue;
		}
		newSettings.push(newCategory);
	}
}

export function getSettingsValue(entry: Guild | User, key: string): string | number | boolean | object {
	const { collection, id } = key2data(key);
	const category = entry.settings_new.find((category) => category.name === collection);
	if (!category) return false;
	// @ts-expect-error idk
	const option = category.options.find((option) => option.id === id);
	if (!option) return false;
	return option.value;
}
