import { MetricsType } from "../../db/managers/metrics.js";
import { ImageBuffer } from "../../util/image.js";

export interface MetricsChartDisplayFilter {
	exclude?: string[];
	include?: string[];
}

export interface MetricsChartDisplaySettings {
	filter?: MetricsChartDisplayFilter;
	period?: string | number;
}

export interface MetricsChart {
	/* Display name of this chart */
	description: string;
	name: string;

	/* Which type of chart this is */
	type: MetricsType;

	/* Various display settings for the graph */
	settings?: Pick<MetricsChartDisplaySettings, "filter">;
}

export const MetricsCharts: MetricsChart[] = [
	{
		description: "Guild joins & leaves",
		name: "guilds",
		type: "guilds",

		settings: {
			filter: {
				exclude: [ "total" ]
			}
		}
	},

	{
		description: "Total guilds",
		name: "guilds-total",
		type: "guilds",

		settings: {
			filter: {
				exclude: [ "joins", "leaves" ]
			}
		}
	},

	{
		description: "Where cool-down messages are displayed",
		name: "cooldown-messages",
		type: "cooldown"
	},

	{
		description: "Usage of commands",
		name: "commands",
		type: "commands",
        settings: {
            filter: {
                exclude: [ "settings", "campaign", "i", "chat", "bot" ]
            }
        }
	},

	{
		description: "Usage of /bot",
		name: "commands-bot",
		type: "commands",
        settings: {
            filter: {
                include: [ "bot" ]
            }
        }
	},

	{
		description: "Votes for the bot",
		name: "votes",
		type: "vote"
	},

	{
		description: "Usage of chat models",
		name: "chat-models",
		type: "chat",

		settings: {
			filter: {
				exclude: [ "tones", "sources", "tokens", "models.chatgpt" ]
			}
		}
	},

	{
		description: "Usage of chat tones",
		name: "chat-tones",
		type: "chat",

		settings: {
			filter: {
				exclude: [ "models", "sources", "tokens", "tones.neutral" ]
			}
		}
	},

	{
		description: "Token usage for chat models (prompt)",
		name: "chat-tokens-prompt",
		type: "chat",

		settings: {
			filter: {
				exclude: [ "models", "sources", "tones", "tokens.completion" ]
			}
		}
	},

	{
		description: "Token usage for chat models (completion)",
		name: "chat-tokens-completion",
		type: "chat",

		settings: {
			filter: {
				exclude: [ "models", "sources", "tones", "tokens.prompt" ]
			}
		}
	},

	{
		description: "How chat interactions are done",
		name: "chat-sources",
		type: "chat",

		settings: {
			filter: {
				exclude: [ "models", "tones", "tokens" ]
			}
		}
	},

	{
		description: "Usage of image models",
		name: "image-models",
		type: "image",

		settings: {
			filter: {
				exclude: [ "steps", "counts" ]
			}
		}
	},

	{
		description: "Usage of image amounts",
		name: "image-count",
		type: "image",

		settings: {
			filter: {
				exclude: [ "steps", "models" ]
			}
		}
	},

	{
		description: "Usage of image ratios",
		name: "image-ratios",
		type: "image",

		settings: {
			filter: {
				exclude: [ "counts", "models" ]
			}
		}
	}
]

export interface TuringChartOptions {
    chart: MetricsChart | MetricsType;
    settings?: MetricsChartDisplaySettings;
}

export interface TuringRawChartResult {
    image: string;
}

export interface TuringChartResult {
    image: ImageBuffer;
}