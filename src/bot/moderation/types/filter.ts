import type { Bot } from "@discordeno/bot";

import type { DBInfraction } from "../../../db/types/moderation.js";
import type { DBEnvironment } from "../../../db/types/index.js";
import type { ModerationSource } from "./index.js";

/* Which action to perform regarding the flagged content */
export type ModerationFilterActionType = "ban" | "warn" | "block" | "flag";

export type ModerationFilterAction = Pick<DBInfraction, "reason"> & {
	/** Which moderation filter was used */
	filter: string;

	/* Which action to perform */
	type: ModerationFilterActionType;

	/* How long to ban the entry for, if applicable */
	duration?: number;
};

interface ModerationFilterHandlerOptions {
	bot: Bot;
	content: string;
	source: ModerationSource;
	env: DBEnvironment;
}

export interface ModerationFilter {
	/** Name of the filter */
	name: string;

	/** Handler of the filter */
	handler: (options: ModerationFilterHandlerOptions) => Promise<Omit<ModerationFilterAction, "filter"> | null>;
}
