export interface Style {
	/** Name of the chat tone */
	name: string;

	/** Identifier of the chat tone */
	id: string;

	/** Description of the chat tone */
	description: string;

	/** Emoji of the chat tone */
	emoji: string;

	/* Tags of the style */
	tags: string[];
}

export const TONES: Style[] = [];
