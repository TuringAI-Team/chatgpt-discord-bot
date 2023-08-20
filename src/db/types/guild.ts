import type { DBSettings } from "../../bot/types/settings.js";
import type { DBPlan, DBSubscription } from "./premium.js";
import type { DBInfraction } from "./moderation.js";

export interface DBGuild {
	/** ID of the guild */
	id: string;

	/** When the guild first interacted with the bot */
	created: string;

	/** Moderation history of the guild */
	infractions: DBInfraction[];

	/** Data about the guild's subscription */
	subscription: DBSubscription | null;

	/** Data about the guild's pay-as-you-go plan */
	plan: DBPlan | null;

	/** The guild's configured settings */
	settings: DBSettings;

    /* The guild's metadata */
    metadata: Record<string, any>;
}