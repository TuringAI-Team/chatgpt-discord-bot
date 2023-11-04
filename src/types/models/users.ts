import { DiscordEmoji, Localization } from "@discordeno/bot";
import { InfractionReference, InfractionType, ModerationResult } from "../moderation.js";
import { SettingCategory } from "../settings.js";
import { Plan, Subscription } from "../subscription.js";

export interface UserLanguage {
	/** Name ofthe language */
	name: string;

	/** Emoji of the language, e.g. the country's flag */
	emoji: string;

	/** ISO code of the language */
	id: string;
}

export const USER_LANGUAGES: UserLanguage[] = [
	{
		name: "English",
		id: "en-US",
		emoji: "🇬🇧",
	},

	{
		name: "Spanish",
		id: "es-ES",
		emoji: "🇪🇸",
	},

	{
		name: "Brazilian Portuguese",
		id: "pt-BR",
		emoji: "🇧🇷",
	},

	{
		name: "Portuguese",
		id: "pt-PT",
		emoji: "🇵🇹",
	},

	{
		name: "French",
		id: "fr-FR",
		emoji: "🇫🇷",
	},

	{
		name: "German",
		id: "de-DE",
		emoji: "🇩🇪",
	},

	{
		name: "Italian",
		id: "it-IT",
		emoji: "🇮🇹",
	},

	{
		name: "Polish",
		id: "pl",
		emoji: "🇵🇱",
	},

	{
		name: "Russian",
		id: "ru-RU",
		emoji: "🇷🇺",
	},

	{
		name: "Bulgarian",
		id: "bg",
		emoji: "🇧🇬",
	},

	{
		name: "Czech",
		id: "cs",
		emoji: "🇨🇿",
	},

	{
		name: "Japanese",
		id: "jp-JP",
		emoji: "🇯🇵",
	},

	{
		name: "Chinese",
		id: "zh-CN",
		emoji: "🇨🇳",
	},

	{
		name: "Vietnamese",
		id: "vn",
		emoji: "🇻🇳",
	},

	{
		name: "Persian",
		id: "ir",
		emoji: "🇮🇷",
	},

	{
		name: "Pirate",
		id: "pirate",
		emoji: "🏴‍☠️",
	},
];
export interface LoadingIndicator {
	/* Name of the loading indicator */
	name: string;

	/* Discord emoji */
	emoji: DiscordEmoji;
}

export const LOADING_INDICATORS: LoadingIndicator[] = [
	{
		name: "Discord Loading #1",
		emoji: {
			name: "loading",
			id: "1051419341914132554",
			animated: true,
		},
	},

	{
		name: "Discord Loading #2",
		emoji: {
			name: "discord_loading",
			id: "1103039423806976021",
			animated: true,
		},
	},

	{
		name: "Orb",
		emoji: {
			name: "orb",
			id: "1102556034276528238",
			animated: true,
		},
	},

	{
		name: "Turing Spin",
		emoji: {
			name: "turing_spin",
			id: "1104867917436289065",
			animated: true,
		},
	},

	{
		name: "Discord Typing",
		emoji: {
			name: "discord_typing",
			id: "1103039408728445071",
			animated: true,
		},
	},

	{
		name: "Loading Bars",
		emoji: {
			name: "loading2",
			id: "1104458865224990780",
			animated: true,
		},
	},

	{
		name: "Vibe Rabbit",
		emoji: {
			name: "rabbit",
			id: "1078943805316812850",
			animated: true,
		},
	},

	{
		name: "Spinning Skull",
		emoji: {
			name: "spinning_skull",
			id: "1102635532258906224",
			animated: true,
		},
	},

	{
		name: "Spinning Tux",
		emoji: {
			name: "tux_spin",
			id: "1103014814135099573",
			animated: true,
		},
	},

	{
		name: "LEGO",
		emoji: {
			name: "lego",
			id: "1105171703170076744",
			animated: true,
		},
	},

	{
		name: "Spinning Cat #1",
		emoji: {
			name: "spinning_maxwell",
			id: "1104458871642259506",
			animated: true,
		},
	},

	{
		name: "Spinning Cat #2",
		emoji: {
			name: "spinning_cat",
			id: "1104458868546867424",
			animated: true,
		},
	},

	{
		name: "SpongeBob",
		emoji: {
			name: "spunchbob",
			id: "1104869247290716201",
			animated: true,
		},
	},

	{
		name: "Spinning Cat Cube",
		emoji: {
			name: "spinning_cat_cube",
			id: "1105185931209756693",
			animated: true,
		},
	},
];

export interface Infractions {
	/** Type of moderation action */
	type: InfractionType;

	/** ID of the infraction */
	id: string;

	/** When this action was taken */
	when: number;

	/** Which bot moderator took this action, Discord identifier */
	by?: string;

	/** Why this action was taken */
	reason?: string;

	/** Whether the user has seen this infraction */
	seen?: boolean;

	/** How long this infraction lasts, e.g. for bans */
	until?: number;

	/** Reference for this infraction */
	reference?: InfractionReference;

	/** Used for `moderation` infractions */
	moderation?: ModerationResult;
}

export interface User {
	id: string;
	created: Date;
	moderator: boolean;
	interactions: DBInteractions;
	infractions: Infractions[];
	subscription: Subscription | null;
	plan: Plan | null;
	voted: string | null;
	settings: {
		[key: string]: string | number | boolean | object | Array<string | number | boolean>;
	};
	settings_new: SettingCategory[];
	metadata: Record<string, unknown>;
	roles: Role[];
}

export type DBInteractions = Record<string, number>;

export enum UserType {
	PremiumSubscription = "subscription",
	PremiumPlan = "plan",
	Voter = "voter",
	User = "user",
}

export enum Role {
	Owner = "owner",
	Moderator = "moderator",
	Investor = "investor",
	Advertiser = "advertiser",
	API = "api",
	Tester = "tester",
}
