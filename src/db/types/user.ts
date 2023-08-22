import type { DBSettings } from "../../bot/types/settings.js";
import type { DBPlan, DBSubscription } from "./premium.js";
import type { DBInfraction } from "./moderation.js";

import { getSettingsValue } from "../../bot/settings.js";
import { DiscordComponentEmoji } from "../../bot/types/discordeno.js";

export interface DBUser {
	/** ID of the user */
	id: string;

	/** When the user first interacted with the bot */
	created: string;

	/** How many interactions the user has with the bot */
	interactions: DBInteractions;

	/** Moderation history of the user */
	infractions: DBInfraction[];

	/** Data about the user's subscription */
	subscription: DBSubscription | null;

	/** Data about the user's pay-as-you-go plan */
	plan: DBPlan | null;

	/** When the user last voted for the bot */
	voted: string | null;

	/** The user's configured settings */
	settings: DBSettings;

    /** The user's metadata */
    metadata: Record<string, any>;

    /** The user's roles */
    roles: DBRole[];
}

export enum DBUserType {
	PremiumSubscription = "subscription",
	PremiumPlan = "plan",
	Voter = "voter",
	User = "user"
}

export enum DBRole {
	Owner = "owner",
	Moderator = "moderator",
	Investor = "investor",
	Advertiser = "advertiser",
	API = "api",
	Tester = "tester"
}

export type DBInteractions = Record<string, number>;

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
		name: "English", id: "en-US", emoji: "🇬🇧"
	},

	{
		name: "Spanish", id: "es-ES", emoji: "🇪🇸"
	},

	{
		name: "Brazilian Portuguese", id: "pt-BR", emoji: "🇧🇷"
	},

	{
		name: "Portuguese", id: "pt-PT", emoji: "🇵🇹"
	},

	{
		name: "French", id: "fr-FR", emoji: "🇫🇷"
	},

	{
		name: "German", id: "de-DE", emoji: "🇩🇪"
	},

	{
		name: "Italian", id: "it-IT", emoji: "🇮🇹"
	},

	{
		name: "Polish", id: "pl", emoji: "🇵🇱"
	},

	{
		name: "Russian", id: "ru-RU", emoji: "🇷🇺"
	},

	{
		name: "Bulgarian", id: "bg", emoji: "🇧🇬"
	},

	{
		name: "Czech", id: "cs", emoji: "🇨🇿"
	},

	{
		name: "Japanese", id: "jp-JP", emoji: "🇯🇵"
	},

	{
		name: "Chinese", id: "zh-CN", emoji: "🇨🇳"
	},

	{
		name: "Vietnamese", id: "vn", emoji: "🇻🇳"
	},

	{
		name: "Persian", id: "ir", emoji: "🇮🇷",
	},

	{
		name: "Pirate", id: "pirate", emoji: "🏴‍☠️"
	}
];

export interface LoadingIndicator {
    /* Name of the loading indicator */
    name: string;

    /* Discord emoji */
    emoji: Required<DiscordComponentEmoji>;
}

export const LOADING_INDICATORS: LoadingIndicator[] = [
	{
		name: "Discord Loading #1",
		emoji: {
			name: "loading", id: 1051419341914132554n, animated: true
		}
	},

	{
		name: "Discord Loading #2",
		emoji: {
			name: "discord_loading", id: 1103039423806976021n, animated: true
		}
	},

	{
		name: "Orb",
		emoji: {
			name: "orb", id: 1102556034276528238n, animated: true
		}
	},

	{
		name: "Turing Spin",
		emoji: {
			name: "turing_spin", id: 1104867917436289065n, animated: true
		}
	},

	{
		name: "Discord Typing",
		emoji: {
			name: "discord_typing", id: 1103039408728445071n, animated: true
		}
	},

	{
		name: "Loading Bars",
		emoji: {
			name: "loading2", id: 1104458865224990780n, animated: true
		}
	},

	{
		name: "Vibe Rabbit",
		emoji: {
			name: "rabbit", id: 1078943805316812850n, animated: true
		}
	},

	{
		name: "Spinning Skull",
		emoji: {
			name: "spinning_skull", id: 1102635532258906224n, animated: true
		}
	}, 

	{
		name: "Spinning Tux",
		emoji: {
			name: "tux_spin", id: 1103014814135099573n, animated: true
		}
	},

	{
		name: "LEGO",
		emoji: {
			name: "lego", id: 1105171703170076744n, animated: true
		}
	},

	{
		name: "Spinning Cat #1",
		emoji: {
			name: "spinning_maxwell", id: 1104458871642259506n, animated: true
		}
	},

	{
		name: "Spinning Cat #2",
		emoji: {
			name: "spinning_cat", id: 1104458868546867424n, animated: true
		}
	},

	{
		name: "SpongeBob",
		emoji: {
			name: "spunchbob", id: 1104869247290716201n, animated: true
		}
	},

	{
		name: "Spinning Cat Cube",
		emoji: {
			name: "spinning_cat_cube", id: 1105185931209756693n, animated: true
		}
	}
];

export function getLoadingIndicatorFromUser(user: DBUser) {
	const id: string = getSettingsValue(user, "general:loading_indicator");
	return LOADING_INDICATORS.find(i => i.emoji.id.toString() === id)!;
}

export function loadingIndicatorToString(indicator: LoadingIndicator) {
	return `<${indicator.emoji.animated ? "a" : ""}:${indicator.emoji.name}:${indicator.emoji.id}>`;
}