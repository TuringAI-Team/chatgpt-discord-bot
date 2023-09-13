import { Bot } from "@discordeno/bot";
import { Environment } from "./other.js";

export enum RestrictionName {
	/** Testing restriction; not given to anyone */
	Test = "test",

	/** Restricted to bot developers & the development server */
	Developer = "dev",

	/** Restricted to Premium members of both types */
	Premium = "premium",

	/** Restricted to bot moderators */
	Moderator = "mod",

	/** Restricted to Premium pay-as-you-go plan members */
	PremiumPlan = "plan",

	/** Restricted to Premium subscription members */
	PremiumSubscription = "sub",
}

export enum SettingsLocation {
	Guild = "g",
	User = "u",
	Both = "b",
}

export enum SettingsOptionType {
	/** Simple true-false value */
	Boolean,

	/** Users can choose from a list */
	Choices,
}

export type Settings = Record<string, string | number | boolean>;

export interface SettingsOptionChoice<T> {
	/** Name of the choice */
	name: string;

	/** Description of the choice */
	description?: string;

	/** Emoji of the choice */
	emoji?: string;

	/** Restrictions of the choice */
	restrictions?: RestrictionName[];

	/** Value of the choice */
	value: T;
}

export type SettingsOption<T extends string | number | boolean = any> = BooleanSettingsOption | ChoiceSettingsOption<T>;

interface BaseSettingsOption<T> {
	/** Name of the settings option */
	name: string;

	/** Emoji for the settings option */
	emoji: string;

	/** Description of the settings option */
	description: string;

	/** Type of the setting */
	type: SettingsOptionType;

	/** Location of the setting */
	location?: SettingsLocation;

	/** Handler to execute when this setting is changed */
	handler?: (bot: Bot, env: Environment, value: T) => Promise<void> | void;

	/** Default value of this settings option */
	default: T;
}

type BooleanSettingsOption = BaseSettingsOption<boolean> & {
	type: SettingsOptionType.Boolean;
};

type ChoiceSettingsOption<T> = BaseSettingsOption<T> & {
	type: SettingsOptionType.Choices;

	/** Choices for the option */
	choices: SettingsOptionChoice<T>[];
};

export interface SettingsCategory {
	/** Name of the category */
	name: string;

	/** Emoji for the category */
	emoji: string;

	/** Available options for the category */
	options: SettingsOption[];
}
