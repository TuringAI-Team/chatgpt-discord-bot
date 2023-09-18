import { Guild } from "../../types/models/guilds.js";
import { User } from "../../types/models/users.js";
import { SettingsCategory, SettingsChoices } from "../../types/settings.js";

function key2data(key: string) {
	const [collection, id] = key.split(":");
	return { collection, id };
}

export async function oldSettingsMigration(entry: Guild | User) {
	if (entry.settings_new.length >= 1) return;
	let oldSettings = entry.settings;
	if (!oldSettings) return;
	let newSettings: Array<SettingsCategory> = [];
	let oldSettingsArray = Object.entries(oldSettings);
	for (let i = 0; i < oldSettingsArray.length; i++) {
		let category = oldSettingsArray[i];
		let newCategory = {
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
	const option = category.options.find((option) => option.id === id);
	if (!option) return false;
	return option.value;
}
