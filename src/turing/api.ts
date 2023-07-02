import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import { Awaitable } from "discord.js";
import { EventEmitter } from "events";

import { ChatSettingsPlugin, ChatSettingsPluginIdentifier } from "../conversation/settings/plugin.js";
import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { RunPodPath, RunPodRawStreamResponseData } from "../runpod/api.js";
import { TuringAPIError, TuringErrorBody } from "../error/gpt/turing.js";
import { ChoiceSettingOptionChoice } from "../db/managers/settings.js";
import { ChatOutputImage, ImageBuffer } from "../chat/types/image.js";
import { Conversation } from "../conversation/conversation.js";
import { ChatInputImage } from "../chat/types/image.js";
import { MetricsType } from "../db/managers/metrics.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { DatabaseUser } from "../db/schemas/user.js";
import { ImageAPIPath } from "../image/manager.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { StreamBuilder } from "../util/stream.js";
import { Bot } from "../bot/bot.js";
import { OpenAIChatMessage, TuringOpenAIChatBody, TuringOpenAIPartialResult, TuringOpenAIResult } from "./types/chat.js";
import { GoogleChatResult, TuringGoogleChatBody } from "./types/google.js";

type TuringAPIPath = 
    `cache/${string}`
    | "text/filter" | `text/${string}` | `text/alan/${TuringAlanChatModel}` | `text/gpt/${TuringChatPluginsModel}`
    | `video/${TuringVideoModelName}`
    | `chart/${MetricsType}`
    | `image/mj/${"describe" | "imagine" | MidjourneyAction}`
    | `image/${ImageAPIPath}`
    | `runpod/${RunPodPath}`
    | "audio/transcript"

type TuringAPIFilter = "nsfw" | "cp" | "toxicity"

interface TuringAPIFilterResult {
    nsfw: boolean;
    youth: boolean;
    cp: boolean;
    toxic: boolean;
}

type TuringChatModel = string

interface TuringChatOptions {
    /* Conversation this request corresponds to */
    conversation: Conversation;

    /* Which model to use */
    model: TuringChatModel;

    /* Prompt to pass to the model */
    prompt: string;

    /* Whether to pass the raw prompt to the model, instead of the API building the prompt */
    raw?: boolean;
}

type TuringAPIChatBody = Pick<TuringChatOptions, "prompt"> & {
    conversationId?: string;
    chat?: boolean;
}

export interface TuringChatResult {
    response: string;
}

export type TuringVideoModelName = "damo" | "videocrafter"

export interface TuringVideoModel {
    /* Name of the model */
    name: string;

    /* Identifier of the model */
    id: TuringVideoModelName;
}

export const TuringVideoModels: TuringVideoModel[] = [
    {
        name: "DAMO Text-to-video",
        id: "damo"
    },

    {
        name: "VideoCrafter",
        id: "videocrafter"
    }
]

export interface TuringVideoOptions {
    /* Which prompt to generate a video for */
    prompt: string;

    /* Which video generation model to use */
    model: TuringVideoModel | TuringVideoModelName;
}

export interface TuringVideoResult {
    /* URL to the generated video */
    url: string;

    /* How long it took to generate the video, in milliseconds */
    duration: number;
}

export interface TuringImageOptions {
    prompt: string;
    count: number;
}

export interface TuringImageResult {
    images: ImageBuffer[];
    duration: number;
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

type TuringAlanPluginName = string
type TuringAlanChatModel = "chatgpt"

export interface TuringAlanImageGenerator {
    name: string;
    type: "dall-e-2" | "kandinsky" | "stable-diffusion" | "midjourney" | TuringAlanParameter;
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
        name: "MJ",
        type: "midjourney"
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
		description: "Usage of Stable Horde models",
		name: "stable-models",
		type: "image",

		settings: {
			filter: {
				exclude: [ "steps", "counts", "kudos" ]
			}
		}
	},

	{
		description: "Usage of Stable Horde generation steps",
		name: "stable-steps",
		type: "image",

		settings: {
			filter: {
				exclude: [ "counts", "models", "kudos" ]
			}
		}
	},

	{
		description: "Usage of Stable Horde image count",
		name: "stable-count",
		type: "image",

		settings: {
			filter: {
				exclude: [ "steps", "models", "kudos" ]
			}
		}
	},

	{
		description: "Kudos spent on Stable Horde",
		name: "stable-kudos",
		type: "image",

		settings: {
			filter: {
				exclude: [ "counts", "models", "steps" ]
			}
		}
	},

	{
		description: "Actions performed using MJ",
		name: "mj-actions",
		type: "midjourney",

		settings: {
			filter: {
				exclude: [ "rate", "credits" ]
			}
		}
	},

	{
		description: "Ratings for MJ images",
		name: "mj-ratings",
		type: "midjourney",

		settings: {
			filter: {
				exclude: [ "generation", "upscale", "variation" ]
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

export type TuringChatPluginsResult = TuringOpenAIResult & {
    tool: string | null;
}

export type TuringChatPluginsPartialResult = TuringChatPluginsResult

export type MidjourneyModelIdentifier = "5.1" | "5" | "niji" | "4" | "3" | "2" | "1"

export interface MidjourneyModel {
    /* Display name of the model */
    name: string;

    /* Identifier of the model, to use for the API */
    id: MidjourneyModelIdentifier;
}

export const MidjourneyModels: MidjourneyModel[] = [
    { name: "5.1", id: "5.1" },
    { name: "5", id: "5" },
    { name: "Niji (v5)", id: "niji" },
    { name: "4", id: "4" },
    { name: "3", id: "3" },
    { name: "2", id: "2" },
    { name: "1", id: "1" }
]

export type MidjourneyMode = "fast" | "relax"

export interface MidjourneyPartialResult {
    prompt: string;
    status: number | null;
    image?: string;
    done: boolean;
    credits: number;
    error?: string;
    id: string;
    action?: MidjourneyAction;
    number?: number;
    jobId?: string;
    queued?: number;
}

export type MidjourneyResult = Required<MidjourneyPartialResult>

interface MidjourneyBody {
    prompt?: string;
    model?: MidjourneyModelIdentifier;
    number?: number;
    id?: string;
    mode?: MidjourneyMode;
    premium?: boolean;
}

export type MidjourneyOptions = Omit<MidjourneyBody, "mode" | "premium"> & {
    /* Database instances, to determine whether to use the fast generation mode */
    db: DatabaseInfo;

    /* Progress callback to call when there's a new image generation status */
    progress: (result: MidjourneyPartialResult) => Awaitable<void>;

    /* Which action to perform otherwise */
    action?: MidjourneyAction;
}

export type MidjourneyAction = "variation" | "upscale"

export interface TuringChatBingResult {
    response: string;
    done: boolean;
}

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

type TuringAPIMethod = "GET" | "POST" | "DELETE"

interface TuringAPIRequest {
    method?: TuringAPIMethod;
    body?: any;
    path: TuringAPIPath;
    raw?: boolean;
}

export interface TuringAPIRawResponse<T = any> {
    data: T;
    code: number;
    success: boolean;
    error: TuringErrorBody | null;
}

export class TuringAPI extends EventEmitter {
    public readonly bot: Bot;

    constructor(bot: Bot) {
        super();
        this.bot = bot;
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

    public async cancelImagineRequest(id: string): Promise<void> {
        this.emit("cancelled", id);
    }

    public async imagine({ db, prompt, model, progress, action, id, number }: MidjourneyOptions): Promise<MidjourneyResult> {
        /* Latest message of the stream */
        let latest: MidjourneyPartialResult | null = null;

        /* Whether the user can use the fast mode */
        const premium: boolean = await this.bot.db.users.canUsePremiumFeatures(db);
        const mode: MidjourneyMode = premium ? "fast" : "relax";

        /* Whether the generation is finished */
        let done: boolean = false;

        /* Request body for the API */
        const body: MidjourneyBody = {
            prompt, model, id, number, mode, premium
        };

        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            const abortTimer: NodeJS.Timeout = setTimeout(() => {
                controller.abort();
                reject(new TypeError("Request timed out"));
            }, 120 * 1000);

            /* Image generation cancel listener */
            const listener = (cancelledID: string) => {
                if (latest === null || latest.id !== cancelledID) return;

                clearInterval(abortTimer);
                reject(new GPTGenerationError<string>({ type: GPTGenerationErrorType.Cancelled }));

                this.off("cancelled", listener);
                controller.abort();
            }

            controller.signal.addEventListener("abort", () => this.off("cancelled", listener));
            this.on("cancelled", listener);

            try {
                await fetchEventSource(this.url(`image/mj/${action ?? "imagine"}`), {
                    headers: this.headers() as any,
                    body: JSON.stringify(body),
                    mode: "cors",
                    signal: controller.signal,
                    method: "POST",

                    onclose: () => {
                        if (!done) {
                            done = true;

                            this.off("cancelled", listener);
                            controller.abort();
                            
                            resolve();
                        }
                    },
                    
                    onerror: (error) => {
                        clearTimeout(abortTimer);
                        throw error;
                    },
        
                    onopen: async (response) => {
                        clearTimeout(abortTimer);

                        /* If the request failed for some reason, throw an exception. */
                        if (response.status !== 200) {
                            const error = await this.error(response, `image/mj/${action ?? "imagine"}`, "error");

                            controller.abort();
                            reject(error);
                        }
                    },

                    onmessage: async (event) => {
                        try {
                            /* Response data */
                            const data: MidjourneyPartialResult = JSON.parse(event.data);
                            if (!data) return;

                            latest = data;
                            if (progress !== undefined && (!latest.done || latest.error)) progress(latest);
                            
                            if (data.error) controller.abort();

                        } catch (error) {
                            clearTimeout(abortTimer);
                            throw error;
                        } 
                    }
                });

            } catch (error) {
                if (error instanceof GPTAPIError) return reject(error);

                reject(new GPTGenerationError({
                    type: GPTGenerationErrorType.Other,
                    cause: error as Error
                }));
            }
        });

        if (latest === null) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return latest;
    }

    public async chart({ chart, settings }: TuringChartOptions): Promise<TuringChartResult> {
        /* Chart type specified */
        const type: MetricsType = typeof chart === "object" ? chart.type : chart;

        /* Time frame */
        const period: string | undefined = settings && settings.period ? settings.period.toString() : undefined;

        const filter: MetricsChartDisplayFilter | undefined = settings && settings.filter ? {
            exclude: [], include: undefined,
            ...settings.filter
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

    public async resetAlanConversation({ conversation }: Pick<TuringAlanOptions, "conversation">): Promise<void> {
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

    public async generateVideo(body: TuringVideoOptions): Promise<TuringVideoResult> {
        const name: TuringVideoModelName = typeof body.model === "object" ? body.model.id : body.model;
        const before: number = Date.now();

        const raw: { url: string } | string = await this.request({
            path: `video/${name}`, method: "POST", body
        });

        const url: string = typeof raw === "object" ? raw.url : raw;

        return {
            url, duration: Date.now() - before
        };
    }

    public async filter(prompt: string, which: TuringAPIFilter[]): Promise<TuringAPIFilterResult> {
        return this.request({
            path: "text/filter", method: "POST", body: {
                prompt, filters: which
            }
        });
    }

    public async chatPlugins({ messages, model, plugins, tokens, progress }: TuringChatPluginsOptions): Promise<TuringChatPluginsResult> {
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

    public async google(body: TuringGoogleChatBody): Promise<GoogleChatResult> {
        return await this.request({
            path: "text/google", method: "POST", body
        });
    }

    public async chat(options: TuringChatOptions): Promise<TuringChatResult> {
        const body: TuringAPIChatBody = {
            prompt: options.prompt,
            chat: !options.raw,
            conversationId: options.conversation.id
        };

        console.log(options.model)

        const data: TuringChatResult = await this.request({
            path: `text/${options.model}`, method: "POST", body
        });

        return {
            response: data.response.trim()
        };
    }

    public async resetConversation(model: TuringChatModel): Promise<void> {
        await this.request({
            path: `text/${model}`, method: "DELETE"
        });
    }

    public async request<T>(options: TuringAPIRequest & { raw: true }): Promise<TuringAPIRawResponse<T>>;
    public async request<T>(options: TuringAPIRequest & { raw?: boolean }): Promise<T>;

    public async request<T>(options: TuringAPIRequest): Promise<T | TuringAPIRawResponse<T>> {
        const { path, body, method, raw } = options;

        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: body !== undefined ? JSON.stringify(body) : undefined,
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.status.toString().startsWith("2") && !raw) await this.error(response, path);

        /* Get the response body. */
        const data: T = await response.clone().json().catch(() => null) as T ?? await response.clone().text() as T;

        if (raw) {
            const error: TuringErrorBody | null = await this.error(response, path, "data");
            const success: boolean = response.status.toString().startsWith("2");

            return {
                code: response.status, data,
                success, error
            };
        } else {
            return data;
        }
    }

    public url(path: TuringAPIPath): string {
        const base: string = this.bot.app.config.turing.urls.dev && this.bot.dev
            ? this.bot.app.config.turing.urls.dev ?? this.bot.app.config.turing.urls.prod
            : this.bot.app.config.turing.urls.prod;

        return `${base}/${path}`;
    }
    private async error(response: Response, path: TuringAPIPath, type: "error"): Promise<TuringAPIError | null>;
    private async error(response: Response, path: TuringAPIPath, type: "data"): Promise<TuringErrorBody | null>;
    private async error(response: Response, path: TuringAPIPath, type?: "throw"): Promise<void>;

    private async error(response: Response, path: TuringAPIPath, type: "error" | "data" | "throw" = "throw"): Promise<TuringErrorBody | TuringAPIError | null | void> {
        let body: TuringErrorBody | null = await response.clone().json().catch(() => null);

        if (body === null || body.success === true) {
            if (!response.status.toString().startsWith("2")) {
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

    private headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.bot.app.config.turing.key}`,
            "x-captcha-token": this.bot.app.config.turing.captchas.turnstile,
            "Content-Type": "application/json"
        };
    }
}