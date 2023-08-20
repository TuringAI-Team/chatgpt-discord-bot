import { DBPlan, DBSubscription } from "./premium.js";
import { DBInfraction } from "./moderation.js";

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
	settings: Record<string, any>;

    /* The user's metadata */
    metadata: Record<string, any>;

    /* The user's roles */
    roles: string[];
}

export type DBInteractions = Record<string, number>;