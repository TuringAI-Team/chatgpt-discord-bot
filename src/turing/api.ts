import { TuringTranscribeBody, TuringTranscribeRawResult, TuringTranscribeResult, TuringTranscribeSegment } from "./types/transcribe.js";
import { TuringOpenAIChatBody, TuringOpenAIChatOptions, TuringOpenAIPartialResult, TuringOpenAIResult } from "./types/openai/chat.js";
import { MetricsChartDisplayFilter, TuringChartOptions, TuringChartResult, TuringRawChartResult } from "./types/chart.js";
import { AnthropicChatResult, AnthropicPartialChatResult, TuringAnthropicChatBody } from "./types/anthropic.js";
import { LLaMAPartialChatResult, LLaMAChatResult, TuringLLaMABody } from "./types/llama.js";
import { GoogleChatResult, TuringGoogleChatBody } from "./types/google.js";
import { RunPodPath, RunPodRawStreamResponseData } from "../runpod/api.js";
import { TuringAPIError, TuringErrorBody } from "../error/turing.js";
import { MetricsType } from "../db/managers/metrics.js";
import { TuringDatasetManager } from "./dataset.js";
import { ImageAPIPath } from "../image/manager.js";
import { StreamBuilder } from "../util/stream.js";
import { ImageBuffer } from "../util/image.js";
import { TuringKeyManager } from "./keys.js";
import { Bot } from "../bot/bot.js";
import { OpenChatChatResult, OpenChatPartialResult, TuringOpenChatBody } from "./types/openchat.js";

export type TuringAPIPath = 
    | "text/filter" | `text/${string}`
    | `chart/${MetricsType}`
    | `image/${ImageAPIPath}` | "image"
    | `runpod/${RunPodPath}`
    | "audio/transcript"
    | "other/mp3-to-mp4"
    | "dataset/rate"
    | "key" | `key/u/${string}` | `key/k/${string}/${string}`

type TuringAPIFilter = "nsfw" | "cp" | "toxicity"

interface TuringAPIFilterResult {
    nsfw: boolean;
    youth: boolean;
    cp: boolean;
    toxic: boolean;
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

export interface TuringAPIRequest<Body = any> {
    method?: TuringAPIMethod;
    body?: Body & { stream?: boolean };
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

    public async openAI({ messages, model, plugins, progress, tokens }: TuringOpenAIChatOptions): Promise<TuringOpenAIResult> {
        return await new StreamBuilder<
            TuringOpenAIChatBody, TuringOpenAIPartialResult, TuringOpenAIResult
        >({
            body: {
                plugins: plugins && plugins.length > 0 ? plugins.map(p => p.id) : undefined,
                messages, model, max_tokens: tokens, stream: true
            },

            error: async response => this.error(response, "text/gpt-new", "error"),

            url: this.url("text/gpt-new"),
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

    public async filter(text: string, which: TuringAPIFilter[]): Promise<TuringAPIFilterResult> {
        return this.request({
            path: "text/filter", method: "POST", body: {
                text, filters: which
            }
        });
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

    public async anthropic(body: TuringAnthropicChatBody, progress?: (result: AnthropicPartialChatResult) => void): Promise<AnthropicChatResult> {
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
                if (progress) progress(data);
            }
        }).run();
    }

    public async openChat(body: TuringOpenChatBody, progress?: (result: OpenChatPartialResult) => void): Promise<OpenChatChatResult> {
        return await new StreamBuilder<
            TuringOpenChatBody, OpenChatPartialResult, OpenChatChatResult
        >({
            body: {
                ...body, stream: true
            },

            error: response => this.error(response, "text/openchat", "error"),
            url: this.url("text/openchat"),
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

    public async MP3toMP4(body: TuringMP3toMP4Body): Promise<ImageBuffer> {
        const { videoBase64 }: TuringMP3toMP4Result = await this.request({
            path: "other/mp3-to-mp4", method: "POST", body
        });

        return ImageBuffer.load(videoBase64);
    }

    public async request<T, U = any>(options: TuringAPIRequest<U> & { raw: true }): Promise<TuringAPIRawResponse<T>>;
    public async request<T, U = any>(options: TuringAPIRequest<U> & { raw?: boolean }): Promise<T>;

    public async request<T, U = any>(options: TuringAPIRequest<U>): Promise<T | TuringAPIRawResponse<T>> {
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