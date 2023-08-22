import type { DBInfraction } from "../../../db/types/moderation.js";
import type { DBEnvironment } from "../../../db/types/mod.js";
import type { ModerationSource } from "./mod.js";
import type { DiscordBot } from "../../mod.js";

/* Which action to perform regarding the flagged content */
export type ModerationFilterActionType = "ban" | "warn" | "block" | "flag"

export type ModerationFilterAction = Pick<DBInfraction, "reason"> & {
	/** Which moderation filter was used */
	filter: string;

    /* Which action to perform */
    type: ModerationFilterActionType;

    /* How long to ban the entry for, if applicable */
    duration?: number;
}

interface ModerationFilterHandlerOptions {
	bot: DiscordBot;
	content: string;
	source: ModerationSource;
	env: DBEnvironment
}

export interface ModerationFilter {
	/** Name of the filter */
	name: string;

	handler: (
		options: ModerationFilterHandlerOptions
	) => Promise<Omit<ModerationFilterAction, "filter"> | null>;
}