import type { DBEnvironment } from "../../db/types/index.js";
import type { DiscordBot } from "../index.js";

import { DBRole } from "../../db/types/user.js";

export enum RestrictionType {
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
function restrictions(bot: DiscordBot, { user }: DBEnvironment): RestrictionType[] {
	const types: RestrictionType[] = [];

	if (user.roles.includes(DBRole.Owner)) types.push(RestrictionType.Developer);
	if (user.roles.includes(DBRole.Moderator)) types.push(RestrictionType.Moderator);

	const premiumType = bot.db.premium(user);

	if (premiumType === "subscription") types.push(RestrictionType.PremiumSubscription);
	if (premiumType === "plan") types.push(RestrictionType.PremiumPlan);
	if (premiumType !== null) types.push(RestrictionType.Premium);

	return types;
}

/** Determine whether a user is equal to the restriction type. */
export function restricted(bot: DiscordBot, env: DBEnvironment, type: RestrictionType): boolean {
	return restrictions(bot, env).includes(type);
}