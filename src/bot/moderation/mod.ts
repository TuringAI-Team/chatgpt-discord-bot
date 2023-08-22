import type { Embed } from "discordeno";

import RabbitMQ from "rabbitmq-client";
import { randomUUID } from "crypto";

import type { ModerationNoticeOptions, ModerationOptions, ModerationResult } from "./types/mod.js";
import type { DBInfraction, GiveInfractionOptions } from "../../db/types/moderation.js";
import type { DBGuild } from "../../db/types/guild.js";
import type { DBUser } from "../../db/types/user.js";
import type { DiscordBot } from "../mod.js";

import { EmbedColor, type MessageResponse } from "../utils/response.js";
import { RABBITMQ_URI, SUPPORT_INVITE } from "../../config.js";
import { applyFilters, executeFilters } from "./filters.js";

/* RabbitMQ publisher, used to send moderation flags to the management bot */
const connection = new RabbitMQ.Connection(RABBITMQ_URI);
export const publisher = connection.createPublisher();

/** Moderate the given prompt. */
export async function moderate({ bot, env, source, content }: ModerationOptions) {
	/* Run the moderation filters on the message. */
	const auto = await executeFilters({
		bot, env, source, content
	});

	/* Whether the message should be completely blocked */
	const blocked: boolean = auto !== null && auto.type !== "flag";

	/* Whether the message has been flagged as inappropriate */
	const flagged: boolean = blocked || (auto !== null && auto.type === "flag");

	/* Final moderation result */
	const data: ModerationResult = {
		source, auto, flagged, blocked
	};

	if (flagged) {
		env.user = await giveInfraction<DBUser>(bot, env.user, {
			type: "moderation", moderation: data
		});
	}

	/* Which infraction to give to the user, if applicable */
	const infraction = auto !== null && auto.type !== "flag"
		? applyFilters({ auto }) : null;

	/* Apply the given infraction. */
	if (infraction) env.user = await giveInfraction(bot, env.user, infraction);

	return data;
}

export function moderationNotice({ result }: ModerationNoticeOptions): MessageResponse {
	const embed: Embed = {
		title: "What's this? 🤨",
		footer: { text: `${SUPPORT_INVITE} • Support server` },
		color: result.blocked ? EmbedColor.Red : EmbedColor.Orange 
	};

	if (result.auto && result.auto.type !== "block") {
		if (result.auto.type === "warn") embed.description = "Your prompt violates our **usage policies** & you have received a **warning**. *If you continue to violate the usage policies, we may have to take additional moderative actions*.";
		else if (result.auto.type === "ban") embed.description = "Your prompt violates our **usage policies** & you have been **banned** from using the bot. _If you want to appeal or have questions about your ban, join the **support server**_.";
		else if (result.auto.type === "flag") embed.description = "Your prompt may violate our **usage policies**. *If you violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.";
	} else if (result.blocked) embed.description = "Your prompt violates our **usage policies**. *If you actually violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.";
	else if (result.flagged) embed.description = "Your prompt may violate our **usage policies**. *If you violate the usage policies, we may have to take moderative actions; otherwise you can ignore this notice*.";

	return {
		embeds: embed, ephemeral: true
	};
}

export function giveInfraction<T extends DBGuild | DBUser>(bot: DiscordBot, entry: T, {
	by, reason, type, moderation, reference, until, seen
}: GiveInfractionOptions): Promise<T> {
	/* Raw infraction data */
	const data: DBInfraction = {
		by, reason, type, moderation,

		id: randomUUID().slice(undefined, 8),
		when: Date.now()
	};

	if (type === "warn") data.seen = seen ?? false;
	if (reference) data.reference = reference;
	if (until) data.until = until;

	return bot.db.update<T>((entry as any).interactions ? "users" : "guilds", entry, {
		infractions: [
			...entry.infractions, data
		]
	} as any);
}

/** Check whether a user or guild is banned. */
export function isBanned(entry: DBGuild | DBUser) {
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

export function banNotice(entry: DBGuild | DBUser, infraction: DBInfraction): MessageResponse {
	const location = (entry as any).interactions ? "user" : "guild";

	return {
		embeds: {
			title: `${location === "guild" ? "This server is" : "You are"} banned **${infraction.until ? "temporarily" : "permanently"}** from using the bot 😔`,
			description: `_If you want to appeal or have questions about this ban, join the **[support server](https://${SUPPORT_INVITE})**_.`,
			color: EmbedColor.Red
		}
	};
}