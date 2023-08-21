import type { DBEnvironment } from "../../db/types/mod.js";
import type { DiscordBot } from "../mod.js";

import { DBRole } from "../../db/types/user.js";

export interface RestrictionType {
	/** Name of the restriction */
	name: RestrictionName;

	/** Emoji of the restriction */
	emoji: string;

	/** Description of the restriction, e.g. "premium-only" */
	description: string;
}

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
	PremiumSubscription = "sub"
}

/** Determine which restriction type applies to a user. */
function restrictions(bot: DiscordBot, env: DBEnvironment): RestrictionName[] {
	const types: RestrictionName[] = [];

	if (env.user.roles.includes(DBRole.Owner)) types.push(RestrictionName.Developer);
	if (env.user.roles.includes(DBRole.Moderator)) types.push(RestrictionName.Moderator);

	const premium = bot.db.premium(env);

	if (premium) {
		if (premium.type === "subscription") types.push(RestrictionName.PremiumSubscription);
		if (premium.type === "plan") types.push(RestrictionName.PremiumPlan);
		
		types.push(RestrictionName.Premium);
	}

	return types;
}

/** Determine whether a user is equal to the restriction type. */
export function canUse(bot: DiscordBot, env: DBEnvironment, types: RestrictionName[]): boolean {
	return restrictions(bot, env).some(r => types.includes(r));
}

export function restrictionTypes(restrictions: RestrictionName[]) {
	const types: RestrictionType[] = [];

	for (const r of restrictions) {
		switch (r) {
			case RestrictionName.Test: {
				types.push({ name: r, description: "testing-only", emoji: "🤫" });
				break;
			}

			case RestrictionName.Developer: {
				types.push({ name: r, description: "developer-only", emoji: "🔧" });
				break;
			}

			case RestrictionName.Premium: {
				types.push({ name: r, description: "premium-only", emoji: "✨" });
				break;
			}

			case RestrictionName.Moderator: {
				types.push({ name: r, description: "moderator-only", emoji: "🛠️" });
				break;
			}

			case RestrictionName.PremiumPlan: {
				types.push({ name: r, description: "plan-only", emoji: "📊" });
				break;
			}

			case RestrictionName.PremiumSubscription: {
				types.push({ name: r, description: "subscription-only", emoji: "💸" });
				break;
			}
		}
	}

	return types;
}