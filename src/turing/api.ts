import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Utils } from "../util/utils.js";

type TuringAPIPath = `cache/${string}` | "imgs/filter" | "imgs/dalle" | `text/${string}` | `video/${TuringVideoModelName}`

interface TuringAPIFilterResult {
    isNsfw: boolean;
    isYoung: boolean;
    isCP: boolean;
}

interface TuringChatOptions {
    /* Which model to use */
    model: string;

    /* Prompt to pass to the model */
    prompt: string;
}

type TuringAPIChatBody = Pick<TuringChatOptions, "prompt">

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
    duration: number;
    images: ImageBuffer[];
}

export class TuringAPI {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
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
        const url: string = await this.request<string>(`video/${name}`, "POST", options);

        return {
            url, duration: Date.now() - before
        };
    }

    public async setCache(key: string, value: string): Promise<void> {
        return void await this.request(`cache/${key}`, "POST", { value });
    }

    public async getCache(key: string): Promise<string> {
        const { response }: { response: string } = await this.request(`cache/${key}`, "GET");
        return response;
    }

    public async filter(prompt: string, model: string = "stable_diffusion"): Promise<TuringAPIFilterResult> {
        return this.request("imgs/filter", "POST", {
            prompt, model
        });
    }

    public async chat(options: TuringChatOptions): Promise<TuringChatResult> {
        /* API request body */
        const body: TuringAPIChatBody = {
            prompt: options.prompt
        };

        /* Response data from the API */
        const data = await this.request<TuringChatResult>(`text/${options.model}`, "POST", body);

        return {
            response: data.response.trim()
        };
    }

    private async request<T>(path: TuringAPIPath, method: "GET" | "POST" | "DELETE" = "GET", data?: { [key: string]: any }): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.status.toString().startsWith("2") || (await response.clone().json().catch(() => null))?.error) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.json().catch(() => null) as T ?? await response.text() as T;
        return body;
    }

    private url(path: TuringAPIPath): string {
        return `https://api.turingai.tech/${path}`;
    }

    private async error(response: Response, path: TuringAPIPath): Promise<void> {
        const body: any | null = await response.json().catch(() => null);
    
        throw new GPTAPIError({
            code: body && body.error ? 400 : response.status,
            endpoint: `/${path}`,
            id: null,
            message: body && body.error && typeof body.error === "string" ? body.error : null
        });
    }

    private headers(): HeadersInit {
        return {
            Authorization: `Bearer ${this.bot.app.config.turing.key}`,
            "x-captcha-token": this.bot.app.config.turing.captchas.turnstile,
            "Content-Type": "application/json"
        };
    }
}