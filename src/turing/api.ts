import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import { Awaitable } from "discord.js";
import { EventEmitter } from "events";
import { inspect } from "util";

import { OpenAIChatBody, OpenAIChatCompletionsData, OpenAIChatMessage, OpenAIPartialChatCompletionsJSON } from "../openai/types/chat.js";
import { ChatSettingsPlugin, ChatSettingsPluginIdentifier } from "../conversation/settings/plugin.js";
import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { OpenAIUsageCompletionsData } from "../openai/types/completions.js";
import { ChoiceSettingOptionChoice } from "../db/managers/settings.js";
import { ChatOutputImage, ImageBuffer } from "../chat/types/image.js";
import { Conversation } from "../conversation/conversation.js";
import { ChatInputImage } from "../chat/types/image.js";
import { MetricsType } from "../db/managers/metrics.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { DatabaseUser } from "../db/schemas/user.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { StreamBuilder } from "../util/stream.js";
import { RunPodPath } from "../runpod/api.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

type TuringAPIPath = 
    `cache/${string}`
    | "imgs/filter" | "imgs/dalle"
    | `text/${string}` | `text/alan/${TuringAlanChatModel}` | `text/plugins/${TuringChatPluginsModel}`
    | `video/${TuringVideoModelName}`
    | `chart/${MetricsType}`
    | `imgs/mj/${"describe" | "imagine" | MidjourneyAction}`
    | `runpod/${RunPodPath}`

interface TuringAPIFilterResult {
    isNsfw: boolean;
    isYoung: boolean;
    isCP: boolean;
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
    pluginList: string[];
    photodescription: string | null;
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
		description: "Actions done using Midjourney",
		name: "mj-actions",
		type: "midjourney",

		settings: {
			filter: {
				exclude: [ "rate", "credits" ]
			}
		}
	},

	{
		description: "Ratings for Midjourney images",
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

export type TuringTrackingType = "topgg"

interface TuringChatPluginsBody {
    model: TuringChatPluginsModel;
    max_tokens?: number;
    messages: OpenAIChatMessage[];
    plugins: ChatSettingsPluginIdentifier[];
}

export type TuringChatPluginsModel = "gpt-3.5-turbo-0613" | "gpt-4-0613"

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

export interface TuringChatPluginsPartialResult {
    result: string;
    done: boolean;
    tool: string | null;
    credits: number;
}

export type TuringChatPluginsResult = TuringChatPluginsPartialResult

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

export type TuringChatOpenAIBody = Pick<OpenAIChatBody, "model" | "messages" | "temperature"> & {
    maxTokens?: number;
}

export class TuringAPI extends EventEmitter {
    public readonly bot: Bot;

    constructor(bot: Bot) {
        super();
        this.bot = bot;
    }

    public async openAI(options: TuringChatOpenAIBody, progress?: (data: OpenAIPartialChatCompletionsJSON) => Promise<void> | void): Promise<OpenAIChatCompletionsData> {
        return await new StreamBuilder<
            TuringChatOpenAIBody, OpenAIPartialChatCompletionsJSON, OpenAIPartialChatCompletionsJSON, OpenAIChatCompletionsData
        >({
            body: options,

            error: async response => {
                if (response.status === 400) return new GPTGenerationError({
                    type: GPTGenerationErrorType.Moderation
                });

                return this.error(response, "text/open-ai", true);
            },

            url: this.url("text/open-ai"),
            headers: this.headers(),

            progress: (data, old) => {
                /* If an error occurred, stop generation at this point. */
                if (data.choices[0].error !== undefined) {
                    throw new GPTAPIError({
                        endpoint: "/chat/completions",
                        code: 400,
                        id: data.choices[0].error.code,
                        message: data.choices[0].error.message
                    });
                }

                const updated: OpenAIPartialChatCompletionsJSON = {
                    choices: [
                        {
                            delta: {
                                content: old !== null && old.choices[0].delta.content ? `${old.choices[0].delta.content}${data.choices[0].delta.content ? data.choices[0].delta.content : ""}` : data.choices[0].delta.content,
                                role: "assistant"
                            },

                            finish_reason: data.choices[0].finish_reason,
                            index: data.choices[0].index,
                            error: data.choices[0].error
                        }
                    ]
                };

                if (progress) progress(updated);
                return updated;
            },

            process: final => {
                const usage: OpenAIUsageCompletionsData = {
                    completion_tokens: getPromptLength(final.choices[0].delta.content!),
                    prompt_tokens: countChatMessageTokens(options.messages),
                    total_tokens: 0
                }
    
                usage.total_tokens = usage.completion_tokens + usage.total_tokens;
    
                return {
                    response: {
                        message: final.choices[0].delta as OpenAIChatMessage,
                        finish_reason: final.choices[0].finish_reason!,
                        index: final.choices[0].index
                    },
    
                    usage
                };
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
                await fetchEventSource(this.url(`imgs/mj/${action ?? "imagine"}`), {
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
                            const error = await this.error(response, `imgs/mj/${action ?? "imagine"}`, true);

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

    public trackingURL(db: DatabaseUser, type: TuringTrackingType): `https://l.turing.sh/${TuringTrackingType}/${string}` {
        return `https://l.turing.sh/${type}/${db.id}`;
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

        const result: TuringRawChartResult = await this.request(`chart/${type}`, "POST", {
            period, filter
        });

        return {
            image: ImageBuffer.load(result.image.replace("data:image/png;base64,", ""))
        };
    }

    public async resetAlanConversation({ conversation }: Pick<TuringAlanOptions, "conversation">): Promise<void> {
        await this.request("text/alan/chatgpt", "DELETE", {
            userName: conversation.user.username,
            conversationId: conversation.id
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
                photodescription: image.output && image.output.prompt ? image.output.prompt : null,
                photo: image.output && image.output.url ? image.output.url : image.input ? image.input.url : undefined,
                videoGenerator: "none",
                pluginList: []
            },

            error: response => this.error(response, "text/alan/chatgpt", true),
            headers: this.headers(), progress,
            url: this.url("text/alan/chatgpt")
        }).run();
    }

    public async generateImages(options: TuringImageOptions): Promise<TuringImageResult> {
        const before: number = Date.now();

        /* Generate the images using the API. */
        const data: { result: { response: { data: { url: string }[] } } }
            = await this.request("imgs/dalle", "POST", { prompt: options.prompt, n: options.count });

        const buffers: ImageBuffer[] = [];

        for (const attachment of data.result.response.data) {
            const buffer = await Utils.fetchBuffer(attachment.url);
            if (buffer !== null) buffers.push(buffer);
        }

        return {
            duration: Date.now() - before,
            images: buffers
        };
    }

    public async generateVideo(options: TuringVideoOptions): Promise<TuringVideoResult> {
        const name: TuringVideoModelName = typeof options.model === "object" ? options.model.id : options.model;
        const before: number = Date.now();

        /* Generate the video using the API. */
        const raw: { url: string } | string = await this.request(`video/${name}`, "POST", options);
        const url: string = typeof raw === "object" ? raw.url : raw;

        return {
            url, duration: Date.now() - before
        };
    }

    public async filter(prompt: string, model: string = "stable_diffusion"): Promise<TuringAPIFilterResult> {
        return this.request("imgs/filter", "POST", {
            prompt, model
        });
    }

    public async chatPlugins({ messages, model, plugins, progress }: TuringChatPluginsOptions): Promise<TuringChatPluginsResult> {
        return await new StreamBuilder<
            TuringChatPluginsBody, TuringChatPluginsPartialResult, TuringChatPluginsResult
        >({
            body: {
                messages, plugins: plugins.map(p => p.id), model
            },

            error: response => this.error(response, "text/plugins", true),
            headers: this.headers(), progress,
            url: this.url("text/plugins")
        }).run();
    }

    public async chat(options: TuringChatOptions): Promise<TuringChatResult> {
        /* API request body */
        const body: TuringAPIChatBody = {
            prompt: options.prompt,
            chat: options.raw,
            conversationId: options.conversation.id
        };

        /* Response data from the API */
        const data = await this.request<TuringChatResult>(`text/${options.model}`, "POST", body);

        return {
            response: data.response.trim()
        };
    }

    public async resetConversation(model: TuringChatModel): Promise<void> {
        await this.request(`text/${model}`, "DELETE");
    }

    public async request<T>(path: TuringAPIPath, method: "GET" | "POST" | "DELETE" = "GET", data?: { [key: string]: any }): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.status.toString().startsWith("2") || (await response.clone().json().catch(() => null))?.error) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.clone().json().catch(() => null) as T ?? await response.text() as T;
        return body;
    }

    public url(path: TuringAPIPath): string {
        const base: string = this.bot.app.config.turing.urls.dev && this.bot.dev
            ? this.bot.app.config.turing.urls.dev ?? this.bot.app.config.turing.urls.prod
            : this.bot.app.config.turing.urls.prod;

        return `${base}/${path}`;
    }

    private async error(response: Response, path: TuringAPIPath, dry: true): Promise<GPTAPIError>;
    private async error(response: Response, path: TuringAPIPath, dry?: false): Promise<void>;

    private async error(response: Response, path: TuringAPIPath, dry?: boolean): Promise<GPTAPIError | void> {
        const body: any | null = await response.clone().json().catch(() => null);
    
        const error: GPTAPIError = new GPTAPIError({
            code: body && body.error ? 400 : response.status,
            message: body && body.error ? inspect(body.error.toString(), { depth: 1 }) : null,
            endpoint: `/${path}`,
            id: null
        });

        if (dry) return error;
        else throw error;
    }

    private headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.bot.app.config.turing.key}`,
            "x-captcha-token": this.bot.app.config.turing.captchas.turnstile,
            "Content-Type": "application/json"
        };
    }
}