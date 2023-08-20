import type { DBGuild } from "../../db/types/guild.js";
import type { DBUser } from "../../db/types/user.js";

export function createModeration() {
	return {
		/** Check whether a user or guild is banned. */
		banned: function(entry: DBGuild | DBUser) {
			/* List of all ban-related infractions */
			const infractions = entry.infractions.filter(
				i => (i.type === "ban" || i.type === "unban") && (i.until ? Date.now() < i.until : true)
			);

			if (infractions.length === 0) return null;

			/* Whether the entry is banned; really dumb way of checking it */
			const odd: boolean = infractions.length % 2 > 0;
			if (!odd) return null;

			/* The entry's `ban` infraction */
			const infraction = infractions[infractions.length - 1];
			if (infraction.until && Date.now() >= infraction.until) return null;

			return infraction;
		}
	};
}