import { InfractionReference, InfractionType, ModerationResult } from "../moderation.js";
import { Settings } from "../settings.js";
import { Plan, Subscription } from "../subscription.js";

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
	settings: Settings;
	metadata: Record<string, unknown>;
	roles: Role;
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
