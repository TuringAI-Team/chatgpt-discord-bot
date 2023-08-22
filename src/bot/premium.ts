import type { DBPlan, PlanExpense } from "../db/types/premium.js";
import type { DBEnvironment } from "../db/types/mod.js";
import type { DBGuild } from "../db/types/guild.js";
import type { DBUser } from "../db/types/user.js";
import type { DiscordBot } from "./mod.js";

export async function charge<T extends PlanExpense>(
	bot: DiscordBot, env: DBEnvironment, { type, used, data, bonus }: Pick<T, "type" | "used" | "data"> & { bonus?: number }
): Promise<T | null> {
	if (used === 0) return null;

	const premium = bot.db.premium(env);
	if (!premium || premium.type !== "plan") return null;

	/* Which entry gets charged for this expense, guild or user */
	const entry = env[premium.location]!;
	if (!isPlanRunning(entry)) return null;
	
	/* The new expense */
	const expense: T = {
		type, used, data,
		time: Date.now()
	} as T;

	const updatedUsage = Math.max(
		entry.plan.used + used * (bonus ?? 0 + 1), 0
	);

	await bot.db.update(location(entry), entry, {
		plan: {
			...entry.plan,

			expenses: [ ...entry.plan.expenses, expense ],
			used: updatedUsage
		}
	});

	return expense;
}

function isPlanRunning(entry: DBGuild | DBUser): entry is DBGuild & { plan: DBPlan } | DBUser & { plan: DBPlan } {
	return entry.plan !== null && entry.plan.total > entry.plan.used;
}

function location(entry: DBGuild | DBUser) {
	return (entry as DBUser).interactions ? "users" : "guilds";
}