import { ColorResolvable, Snowflake } from "discord.js";

import { DatabaseCollectionType } from "./db/manager.js";

export interface ConfigDiscordChannel {
    /* ID of the guild */
    guild: Snowflake;

    /* ID of the forum channel */
    channel: Snowflake;
}

export interface ConfigBrandingPartner {
	/* Name of the partner */
	name: string;

	/* Description of the partner */
	description?: string;

	/* Emoji for the partner, optional */
	emoji?: string;

	/* URL to the partner's website */
	url: string;
}

export interface ConfigBranding {
	/* Color to use for most embeds */
	color: ColorResolvable;

	/* List of partners */
	partners: ConfigBrandingPartner[];
}

export interface Config {
	/* Token of the Discord bot */
	discord: {
		/* Credentials of the bot */
		token: string;
		id: Snowflake;

		/* Invite code for the support server */
		inviteCode: string;
	};

	/* Whether metrics about usage, cool-down, guilds, users, etc. should be collected in the database */
	metrics: boolean;

	/* Whether the bot is in development mode */
	dev: boolean;

	/* Branding stuff */
	branding: ConfigBranding;

	/* How many clusters to allocate for the bot */
	clusters: number | string | "auto";
	shardsPerCluster: number;

	channels: {
		/* Where the error messages should be sent; which guild and channel */
		error: ConfigDiscordChannel;

		/* Where the moderation messages should be sent; which guild and channel */
		moderation: ConfigDiscordChannel;

		/* Where status update messages should be sent; which guild and channel */
		status: ConfigDiscordChannel;
	};

	/* OpenAI API information */
	openAI: {
		/* API key */
		key: string;
	};

	/* HuggingFace API information */
	huggingFace: {
		/* API key */
		key: string;
	};

	/* Replicate API information */
	replicate: {
		/* API key */
		key: string;
	};

	/* top.gg API information */
	topgg: {
		/* API key */
		key: string;
	}

	/* Turing API information */
	turing: {
		/* API key */
		key: string;
		super: string;

		urls: {
			prod: string;
			dev?: string;
		}

		/* Various CAPTCHA verification keys */
		captchas: {
			turnstile: string;
		};
	}

	/* OCR.space API information */
	ocr: {
		/* API key */
		key: string;
	};

	/* Various GIF APIs */
	gif: {
		tenor: string;
	};

	/* Stable Horde API secrets & information */
	stableHorde: {
		/* API key */
		key: string;
	};

	/* RabbitMQ configuration */
	rabbitMQ: {
		url: string;
	}

	/* General database information */
	db: {
		supabase: {
			url: string;

			key: {
				anon: string;
				service: string;
			};

			collections?: {
				[key in DatabaseCollectionType]?: string;
			};
		};

		redis: {
			url: string;
			password: string;
			port: number;
		};
	};
}