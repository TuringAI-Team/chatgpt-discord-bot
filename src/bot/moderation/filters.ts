import { bold } from "colorette";

import type { ModerationFilter, ModerationFilterAction, ModerationFilterActionType } from "./types/filter.js";
import type { GiveInfractionOptions } from "../../db/types/moderation.js";
import type { ModerationOptions } from "./types/mod.js";

const MODERATION_FILTERS: ModerationFilter[] = [
	{
		name: "Turing filter",

		handler: async ({ bot, content, source }) => {
			if (source !== "image") return null;

			const data = await bot.api.text.filter({
				text: content, filters: [ "nsfw", "cp", "toxicity" ]
			}) as Record<"nsfw" | "youth" | "cp" | "toxic", boolean>;
	
			if (data.nsfw || data.toxic) return { type: "block", reason: "Not safe for work" };
			if (data.youth) return { type: "block", reason: "Content possibly involving children" };
			if (data.cp) return { type: "ban", reason: "Sexual content involving children" };
	
			return null;
		}
	},

	{
		name: "Development filter",

		handler: async ({ content }) => {
			/* Types of actions to take */
			const types: ModerationFilterActionType[] = [ "ban", "warn", "block", "flag" ];

			const parts: string[] = content.split(":");
			if (parts.length === 1 || parts[0] !== "testFlag") return null;

			const type: string = parts[parts.length - 1];
			if (!types.includes(type as ModerationFilterActionType)) return null;

			return {
				type: type as ModerationFilterActionType,
				reason: "Development test flag"
			};
		}
	}
];

/** Execute all of the moderation filters. */
export async function executeFilters({ bot, content, source }: ModerationOptions): Promise<ModerationFilterAction | null> {
	/* Which action should be performed, if any */
	let action: ModerationFilterAction | null = null;

	for (const filter of MODERATION_FILTERS) {
		/* Try to execute the filter. */
		try {
			const result = await filter.handler({
				bot, content, source
			});

			if (result !== null) {
				action = { ...result, filter: filter.name };
				break;
			}

		} catch (error) {
			bot.logger.warn(`Failed to execute moderation filter ${bold(filter.name)} ->`, error);
		}
	}

	if (action === null) return null;
	if (action.type !== "ban" && action.duration) delete action.duration;

	return action;
}

/** Apply the executed filter's infractions to the entry. */
export function applyFilters({ auto }: {
	auto: ModerationFilterAction
}): GiveInfractionOptions | null {
	if (auto.type === "warn") {
		return {
			type: "warn", reason: auto.reason, seen: false
		};
	}

	return null;
}