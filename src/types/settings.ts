import { Bot } from "@discordeno/bot";
import { Environment } from "./other.js";

export enum RestrictionName {
	Test = "test",
	Developer = "dev",
	Premium = "premium",
	Moderator = "mod",
	PremiumPlan = "plan",
	PremiumSubscription = "sub",
}

export enum SettingsLocation {
	Guild = "g",
	User = "u",
	Both = "b",
}

export type SettingChoice = string | number | boolean;
export interface SettingOption {
	id: string;
	name: string;
	value: string | number | boolean | object;
	emoji: string;
	options: SettingChoice[];
}

export interface SettingCategory {
	name: string;
	emoji: string;
	options: SettingOption[];
}
