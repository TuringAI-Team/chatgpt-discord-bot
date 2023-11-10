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

export type SettingOption = {
	name: string;
	value: string | number | boolean;
	premium?: boolean;
	description?: string;
	emoji?: string;
};
export interface Setting {
	id: string;
	key: string;
	value: string | number | boolean | object | Array<string | number | boolean>;
	metadata?: SettingMetadata;
}

export interface SettingMetadata {
	name: string;
	emoji: string;
	description: string;
	explanation?: string;
	premium?: boolean;
	type?: "boolean" | "input" | "choice" | "multi-choice";
	options?: SettingOption[];
	enabled?: boolean;
}

export type SettingsCategoryNames = "chat" | "image" | "plugins" | "premium" | "general" | "limits";
export interface SettingCategory {
	name: SettingsCategoryNames;
	settings: Setting[];
	metadata?: SettingCategoryMetadata;
}
export interface SettingCategoryMetadata {
	name: string;
	emoji: string;
	description: string;
	premium?: boolean;
	enabled?: boolean;
}
