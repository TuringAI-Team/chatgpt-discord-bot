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

export type SettingChoice =
	| string
	| number
	| boolean
	| {
		name: string;
		value: string | number | boolean;
		premium?: boolean;
		description?: string;
		emoji?: string;
	};
export interface SettingOption {
	id: string;
	key: string;
	value: string | number | boolean | object | Array<string | number | boolean>;
	emoji: string;
	metadata?: {
		name: string;
		description: string;
		explanation?: string;
		premium?: boolean;
		type?: "boolean" | "input" | "choice" | "multi-choice";
		options?: SettingChoice[];
	};
}

export type SettingsCategoryNames = "chat" | "image" | "plugins" | "premium" | "general" | "limits";
export interface SettingCategory {
	name: SettingsCategoryNames;
	emoji: string;
	options: SettingOption[];
	metadata?: {
		premium?: boolean;
	};
}
