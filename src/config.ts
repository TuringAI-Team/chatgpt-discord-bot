import { ColorResolvable, Snowflake } from "discord.js";

import { DatabaseCollectionType } from "./db/managers/user.js";

export interface ConfigDiscordChannel {
    /* ID of the guild */
    guild: Snowflake;

    /* ID of the forum channel */
    channel: Snowflake;
}

export interface ConfigBranding {
	/* Branding color code */
	color: ColorResolvable;
}

export interface Config {
	/* Token of the Discord bot */
	discord: {
		/* Credentials of the bot */
		token: string;
		id: Snowflake;

		/* Invite code for the support server */
		inviteCode: string;

		/* ID of the bot owner */
		owner: Snowflake[];
	};

	/* Whether the bot is in development mode */
	dev: boolean;

	/* Branding stuff */
	branding: ConfigBranding;

	/* How many clusters to allocate for the bot */
	clusters: number | string | "auto";
	shardsPerCluster: number | string | "auto";

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

		/* Various CAPTCHA verification keys */
		captchas: {
			turnstile: string;
		}
	}

	/* OCR.space API information */
	ocr: {
		/* API key */
		key: string;
	};

	/* Tenor API information */
	giphy: {
		/* API key */
		key: string;
	}

	/* Nat playground API information & keys */
	nat: {
		/* User agent to fake */
		userAgent: string;

		/* Session token for authentication with Nat */
		token: string;

		/* Secrets related to Clerk authentication */
		auth: {
			uat: number;
		}
	};

	/* Stable Horde API secrets & information */
	stableHorde: {
		/* API key */
		key: string;
	};

	/* General database information */
	db: {
		supabase: {
			url: string;

			key: {
				anon: string;
				service: string;
			};

			collections: {
				[key in DatabaseCollectionType]: string;
			}
		};
	};
}