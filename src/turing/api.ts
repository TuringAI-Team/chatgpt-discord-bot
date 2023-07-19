import { Awaitable } from "discord.js";

import { OpenAIChatMessage, TuringOpenAIChatBody, TuringOpenAIPartialResult, TuringOpenAIResult } from "./types/openai/chat.js";
import { AnthropicChatResult, AnthropicPartialChatResult, TuringAnthropicChatBody } from "./types/anthropic.js";
import { ChatSettingsPlugin, ChatSettingsPluginIdentifier } from "../conversation/settings/plugin.js";
import { LLaMAPartialChatResult, LLaMAChatResult, TuringLLaMABody } from "./types/llama.js";
import { GoogleChatResult, TuringGoogleChatBody } from "./types/google.js";
import { RunPodPath, RunPodRawStreamResponseData } from "../runpod/api.js";
import { ChoiceSettingOptionChoice } from "../db/managers/settings.js";
import { TuringAPIError, TuringErrorBody } from "../error/turing.js";
import { ChatOutputImage } from "../chat/media/types/image.js";
import { Conversation } from "../conversation/conversation.js";
import { ChatInputImage } from "../chat/media/types/image.js";
import { MetricsType } from "../db/managers/metrics.js";
import { DatabaseUser } from "../db/schemas/user.js";
import { TuringDatasetManager } from "./dataset.js";
import { ImageAPIPath } from "../image/manager.js";
import { StreamBuilder } from "../util/stream.js";
import { ImageBuffer } from "../util/image.js";
import { TuringKeyManager } from "./keys.js";
import { Bot } from "../bot/bot.js";

export type TuringAPIPath = 
    | "text/filter" | `text/${string}`
    | `chart/${MetricsType}`
    | `image/${ImageAPIPath}` | "image"
    | `runpod/${RunPodPath}`
    | "audio/transcript"
    | `other/${"mp3-to-mp4"}`
    | `dataset/${"rate"}`
    | "key" | `key/u/${string}` | `key/k/${string}/${string}`

type TuringAPIFilter = "nsfw" | "cp" | "toxicity"

interface TuringAPIFilterResult {
    nsfw: boolean;
    youth: boolean;
    cp: boolean;
    toxic: boolean;
}

export interface TuringAlanOptions {
    /* Conversation instance, that Alan will use to remember the conversation */
    conversation: Conversation;
    user: DatabaseUser;

    /* Progress callback to call when a new token is generated */
    progress: (result: TuringAlanResult) => void;

    /* Prompt to pass to Alan */
    prompt: string;

    /* Image to send to Alan, may also be the previously attached image to be edited */
    image: {
        input: ChatInputImage | null;
        output: ChatOutputImage | null;
    };
}

export type TuringAlanAction = "image" | "video" | "audio" | "mod-img" | "share-link"

export interface TuringAlanResult {
    /* Whether this is a partial generation result or the final one */
    done: boolean;

    /* Which action Alan is currently taking */
    generating: TuringAlanAction | null;

    /* Which action Alan took */
    generated: TuringAlanAction | null;

    /* Results for the action */
    results: string[] | null;

    /* Prompt used to generate the results */
    generationPrompt: string | null;

    /* Which queries Alan is currently searching for, if applicable */
    searching: string[] | null;

    /* The response by Alan */
    result: string;

    /* How many credits were used for this request */
    credits: number;
}

type TuringAlanParameter = string | "none"
type TuringAlanChatModel = "chatgpt"

export interface TuringAlanImageGenerator {
    name: string;
    type: TuringAlanParameter;
}

export const TuringAlanImageGenerators: TuringAlanImageGenerator[] = [
    {
        name: "DALL·E",
        type: "dall-e-2"
    },

    {
        name: "Kandinsky",
        type: "kandinsky"
    },

    {
        name: "Stable Diffusion",
        type: "stable-diffusion"
    }
]

export interface TuringAlanSearchEngine {
    name: string;
    type: "google" | "duckduckgo" | TuringAlanParameter;
}

export const TuringAlanSearchEngines: TuringAlanSearchEngine[] = [
    {
        name: "Google",
        type: "google"
    },

    {
        name: "DuckDuckGo",
        type: "duckduckgo"
    }
]

export interface TuringAlanImageModifier {
    name: string;
    type: "normal" | "canny" | "hough" | "hed" | "depth" | "pose" | "seg" | TuringAlanParameter;
}

export const TuringAlanImageModifiers: TuringAlanImageModifier[] = [
    { name: "ControlNet Normal", type: "normal" },
    { name: "ControlNet Canny edges", type: "canny" },
    { name: "ControlNet Hough", type: "hough" },
    { name: "ControlNet HED", type: "hed" },
    { name: "ControlNet Depth", type: "depth" },
    { name: "ControlNet Pose", type: "pose" },
    { name: "ControlNet Segmentation", type: "seg" }
]

interface TuringAlanBody {
    userName: string;
    conversationId: string;
    searchEngine: TuringAlanSearchEngine["type"];
    imageGenerator: TuringAlanImageGenerator["type"];
    imageModificator: TuringAlanImageModifier["type"];
    videoGenerator: TuringAlanParameter;
    photo?: string;
    message: string;
}

export const alanOptions = <T extends TuringAlanImageModifier | TuringAlanSearchEngine | TuringAlanImageGenerator>(arr: T[], none: boolean = true): ChoiceSettingOptionChoice[] => {
    if (none) arr.push({
        name: "None",
        type: "none"
    } as any);
    
    return arr.map(entry => ({
        name: entry.name,
        value: entry.type
    }));
}

interface MetricsChartDisplayFilter {
	exclude?: string[];
	include?: string[];
}

interface MetricsChartDisplaySettings {
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

interface TuringChartOptions {
    chart: MetricsChart | MetricsType;
    settings?: MetricsChartDisplaySettings;
}

interface TuringRawChartResult {
    image: string;
}

export interface TuringChartResult {
    image: ImageBuffer;
}

interface TuringChatPluginsBody {
    model: TuringChatPluginsModel;
    max_tokens?: number;
    messages: OpenAIChatMessage[];
    plugins: ChatSettingsPluginIdentifier[];
    stream?: boolean;
}

export type TuringChatPluginsModel = "gpt-3.5-turbo" | "gpt-4"

export interface TuringChatPluginsOptions {
    /* Which model to use */
    model: TuringChatPluginsModel;

    /* Maximum amount of generation tokens */
    tokens: number;

    /* OpenAI chat messages to send to the model */
    messages: OpenAIChatMessage[];

    /* Plugins to use for this request */
    plugins: ChatSettingsPlugin[];

    /* Progress callback to call when a new token is generated */
    progress: (result: TuringChatPluginsPartialResult) => void;

    /* User, who initiated this chat request */
    user: DatabaseUser;
}

type TuringChatPluginsToolResult = Record<any, any> & {
    image?: string;
}

export type TuringChatPluginsResult = TuringOpenAIResult & {
    toolResult: TuringChatPluginsToolResult | null;
    toolInput: any | null;
    tool: string | null;
}

export type TuringChatPluginsPartialResult = TuringChatPluginsResult

export interface TuringTranscribeBody {
    ai: "whisper" | "whisper-fast";
    model: "tiny" | "base" | "small" | "medium";
    url: string;
}

export interface TuringTranscribeSegment {
    text: string;
}

export interface TuringTranscribeRawResult {
    segments: TuringTranscribeSegment[];
}

export interface TuringTranscribeResult {
    text: string;
    segments: TuringTranscribeSegment[];
}

export interface TuringMP3toMP4Body {
    audio: string;
    image: string;
    duration: number;
}

export interface TuringMP3toMP4Result {
    videoBase64: string;
}

type TuringAPIMethod = "GET" | "POST" | "DELETE"

export interface TuringAPIRequest {
    method?: TuringAPIMethod;
    body?: any;
    path: TuringAPIPath;
    raw?: boolean;
    headers?: Record<string, string>;
}

export interface TuringAPIRawResponse<T = any> {
    data: T;
    code: number;
    success: boolean;
    error: TuringErrorBody | null;
}

export class TuringAPI {
    public readonly bot: Bot;

    /* Dataset manager; responsible for rating datasets & UI stuff */
    public readonly dataset: TuringDatasetManager;

    /* Keys manager; responsible for creating & managing keys using the API */
    public readonly keys: TuringKeyManager;

    constructor(bot: Bot) {
        this.bot = bot;

        this.dataset = new TuringDatasetManager(this);
        this.keys = new TuringKeyManager(this);
    }

    public async transcribe(body: TuringTranscribeBody): Promise<TuringTranscribeResult> {
        const data: RunPodRawStreamResponseData<TuringTranscribeRawResult> = await this.request({
            path: "audio/transcript", method: "POST", body
        });

        if (data.status === "FAILED") throw new Error("Failed");

        const segments: TuringTranscribeSegment[] = data.output!.segments.map(s => ({ text: s.text.trim() }));
        const final: string = segments.map(s => s.text).join("\n");

        return {
            segments, text: final
        };
    }

    public async openAI(options: TuringOpenAIChatBody, progress?: (data: TuringOpenAIPartialResult) => Awaitable<void>): Promise<TuringOpenAIResult> {
        return await new StreamBuilder<
            TuringOpenAIChatBody, TuringOpenAIPartialResult, TuringOpenAIResult
        >({
            body: {
                ...options, stream: true
            },

            error: async response => this.error(response, "text/gpt", "error"),

            url: this.url("text/gpt"),
            headers: this.headers(),

            progress: data => {
                if (progress) progress(data);
            }
        }).run();
    }

    public async chart({ chart, settings }: TuringChartOptions): Promise<TuringChartResult> {
        /* Chart type specified */
        const type: MetricsType = typeof chart === "object" ? chart.type : chart;

        /* Time frame */
        const period: string | undefined = settings && settings.period ? settings.period.toString() : undefined;

        const filter: MetricsChartDisplayFilter | undefined = settings && settings.filter ? {
            exclude: [], include: undefined, ...settings.filter
        } : undefined;

        const result: TuringRawChartResult = await this.request({
            path: `chart/${type}`, method: "POST", body: {
                period, filter
            }
        });

        return {
            image: ImageBuffer.load(result.image.replace("data:image/png;base64,", ""))
        };
    }

    public async resetAlan({ conversation }: Pick<TuringAlanOptions, "conversation">): Promise<void> {
        await this.request({
            path: "text/alan/chatgpt", method: "DELETE", body: {
                userName: conversation.user.username,
                conversationId: conversation.id
            }
        });
    }

    public async alan({ prompt, conversation, user, progress, image }: TuringAlanOptions): Promise<TuringAlanResult> {
        /* Various settings */
        const imageModifier = this.bot.db.settings.get(user, "alan:imageModifier");

        return await new StreamBuilder<
            TuringAlanBody, TuringAlanResult
        >({
            body: {
                userName: conversation.user.username,
                conversationId: conversation.id,
                message: prompt,
                imageGenerator: this.bot.db.settings.get(user, "alan:imageGenerator"),
                imageModificator: imageModifier !== "none" ? `controlnet-${imageModifier}` : imageModifier,
                searchEngine: this.bot.db.settings.get(user, "alan:searchEngine"),
                photo: image.output && image.output.url ? image.output.url : image.input ? image.input.url : undefined,
                videoGenerator: "none"
            },

            error: response => this.error(response, "text/alan", "error"),
            headers: this.headers(), progress,
            url: this.url("text/alan")
        }).run();
    }

    public async filter(text: string, which: TuringAPIFilter[]): Promise<TuringAPIFilterResult> {
        return this.request({
            path: "text/filter", method: "POST", body: {
                text, filters: which
            }
        });
    }

    public async openAIPlugins({ messages, model, plugins, tokens, progress }: TuringChatPluginsOptions): Promise<TuringChatPluginsResult> {
        return await new StreamBuilder<
            TuringChatPluginsBody, TuringChatPluginsPartialResult, TuringChatPluginsResult
        >({
            body: {
                messages, plugins: plugins.map(p => p.id), model, max_tokens: tokens, stream: true
            },

            error: response => this.error(response, "text/gpt", "error"),
            url: this.url("text/gpt"),
            headers: this.headers(),

            progress: data => {
                if (progress) progress(data);
            }
        }).run();
    }

    public async llama(body: TuringLLaMABody, progress: (result: LLaMAPartialChatResult) => void): Promise<LLaMAChatResult> {
        return await new StreamBuilder<
            any, LLaMAPartialChatResult, LLaMAChatResult
        >({
            body: {
                ...body, model: "llama2", stream: true
            },

            error: response => this.error(response, "text/other", "error"),
            url: this.url("text/other"),
            headers: this.headers(),

            progress: data => {
                progress(data);
            }
        }).run();
    }

    public async anthropic(body: TuringAnthropicChatBody, progress: (result: AnthropicPartialChatResult) => void): Promise<AnthropicChatResult> {
        return await new StreamBuilder<
            TuringAnthropicChatBody, AnthropicPartialChatResult, AnthropicChatResult
        >({
            body: {
                ...body, stream: true
            },

            error: response => this.error(response, "text/anthropic", "error"),
            url: this.url("text/anthropic"),
            headers: this.headers(),

            progress: data => {
                progress(data);
            }
        }).run();
    }

    public async google(body: TuringGoogleChatBody): Promise<GoogleChatResult> {
        return await this.request({
            path: "text/google", method: "POST", body
        });
    }

    public async MP3toMP4(body: TuringMP3toMP4Body): Promise<ImageBuffer> {
        const { videoBase64 }: TuringMP3toMP4Result = await this.request({
            path: "other/mp3-to-mp4", method: "POST", body
        });

        return ImageBuffer.load(videoBase64);
    }

    public async request<T>(options: TuringAPIRequest & { raw: true }): Promise<TuringAPIRawResponse<T>>;
    public async request<T>(options: TuringAPIRequest & { raw?: boolean }): Promise<T>;

    public async request<T>(options: TuringAPIRequest): Promise<T | TuringAPIRawResponse<T>> {
        const { path, body, method, raw } = options;
        
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: body !== undefined ? JSON.stringify(body) : undefined,
            headers: {
                ...this.headers(),
                ...options.headers ?? {}
            }
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.ok && !raw) await this.error(response, path);

        /* Get the response body. */
        const data: T & { success?: boolean } = await response.clone().json().catch(() => null);

        if (raw) {
            const error: TuringErrorBody | null = await this.error(response, path, "data");
            const success: boolean = response.ok;

            return {
                code: response.status, data, success, error
            };

        } else {
            if (data.success === false) await this.error(response, path);
            return data;
        }
    }

    public url(path: TuringAPIPath): string {
        const base: string = this.bot.app.config.turing.urls.dev && this.bot.dev
            ? this.bot.app.config.turing.urls.dev ?? this.bot.app.config.turing.urls.prod
            : this.bot.app.config.turing.urls.prod;

        return `${base}/${path}`;
    }

    public async error(response: Response, path: TuringAPIPath, type: "error"): Promise<TuringAPIError | null>;
    public async error(response: Response, path: TuringAPIPath, type: "data"): Promise<TuringErrorBody | null>;
    public async error(response: Response, path: TuringAPIPath, type?: "throw"): Promise<void>;

    public async error(response: Response, path: TuringAPIPath, type: "error" | "data" | "throw" = "throw"): Promise<TuringErrorBody | TuringAPIError | null | void> {
        let body: TuringErrorBody | null = await response.clone().json().catch(() => null);

        if (body === null || body.success === true) {
            if (!response.ok) {
                const error = new TuringAPIError({
                    body: null, code: response.status, endpoint: path
                });
    
                if (type === "throw") throw error;
                else return error;
            }

            if (type !== "throw") return null;
            else return;
        }

        if (type === "data") return body;
        else if (type === "throw" || type === "error") {
            const error = new TuringAPIError({
                body: body, code: response.status, endpoint: path
            });

            if (type === "throw") throw error;
            else return error;
        }
    }

    public headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.bot.app.config.turing.key}`,
            "x-captcha-token": this.bot.app.config.turing.captchas.turnstile,
            "Content-Type": "application/json"
        };
    }
}