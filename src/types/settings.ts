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

export type SettingsChoices = string | number | boolean;
export interface SettingsOption {
	id: string;
	name: string;
	value: string | number | boolean | object;
	emoji: string;
	options: SettingsChoices[];
}

export interface SettingsCategory {
	name: string;

	emoji: string;

	options: SettingsOption[];
}
