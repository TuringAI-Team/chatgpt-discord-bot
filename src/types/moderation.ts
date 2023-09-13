export type InfractionType = "ban" | "unban" | "warn" | "moderation";
export type ModerationFilterActionType = "ban" | "warn" | "block" | "flag";

export interface InfractionReference {
	type: string;
	data: string;
}

export interface Infraction {
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

export type ModerationFilterAction = Pick<Infraction, "reason"> & {
	/** Which moderation filter was used */
	filter: string;

	/* Which action to perform */
	type: ModerationFilterActionType;

	/* How long to ban the entry for, if applicable */
	duration?: number;
};

export enum ModerationSource {
	ChatFromUser = "chatUser",
	ChatFromBot = "chatBot",
	ImagePrompt = "image",
}

export interface ModerationResult {
	/* Whether the message was flagged */
	flagged: boolean;

	/* Whether the message should be completely blocked */
	blocked: boolean;

	/* Auto moderation filter result */
	auto: ModerationFilterAction | null;

	/* Source of the moderation request */
	source: ModerationSource;
}
