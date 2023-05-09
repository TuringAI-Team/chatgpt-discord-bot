import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import { Awaitable } from "discord.js";
import { inspect } from "util";

import { ChoiceSettingOptionChoice, MultipleChoiceSettingsOption } from "../db/managers/settings.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ChatOutputImage, ImageBuffer } from "../chat/types/image.js";
import { Conversation } from "../conversation/conversation.js";
import { ChatInputImage } from "../chat/types/image.js";
import { DatabaseUser } from "../db/managers/user.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

type TuringAPIPath = `cache/${string}` | "imgs/filter" | "imgs/dalle" | `text/${string}` | `video/${TuringVideoModelName}` | `text/alan/${TuringAlanChatModel}`

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

    /* Whether to pass the raw prompt to the model, instead of the API building the prompt */
    raw?: boolean;
}

type TuringAPIChatBody = Pick<TuringChatOptions, "prompt"> & {
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
    progress: (result: TuringAlanResult) => Awaitable<void>;

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
}

type TuringAlanParameter = string | "none"

type TuringAlanPluginName = string
type TuringAlanChatModel = "chatgpt"

export interface TuringAlanImageGenerator {
    name: string;
    type: "dall-e-2" | "kandinsky" | "stable-diffusion" | TuringAlanParameter;
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

export interface TuringAlanPlugin {
    name: string;
    type: "calculator" | "urlReader";
}

export const TuringAlanPlugins: TuringAlanPlugin[] = [
    {
        name: "Calculator",
        type: "calculator"
    },

    {
        name: "URL reader",
        type: "urlReader"
    }
]

interface TuringAlanBody {
    userName: string;
    conversationId: string;
    searchEngine: TuringAlanSearchEngine["type"];
    imageGenerator: TuringAlanImageGenerator["type"];
    imageModificator: TuringAlanImageModifier["type"];
    videoGenerator: TuringAlanParameter;
    pluginList: TuringAlanPluginName[];
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

export class TuringAPI {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public async alan({ prompt, conversation, user, progress, image }: TuringAlanOptions): Promise<TuringAlanResult> {
        /* Latest message of the stream */
        let latest: TuringAlanResult | null = null;

        /* Whether the generation is finished */
        let done: boolean = false;

        /* Various settings */
        const imageModifier = this.bot.db.settings.get(user, "alan:imageModifier");

        /* Enabled Alan plugins */
        const plugins: string[] = Object.entries(this.bot.db.settings.get(user, "alan:plugins") as MultipleChoiceSettingsOption)
            .filter(([ _, enabled ]) => enabled)
            .map(([ key ]) => key);

        /* Request body for the API */
        const body: TuringAlanBody = {
            conversationId: conversation.userIdentifier,
            userName: conversation.user.username,
            message: prompt,
            imageGenerator: this.bot.db.settings.get(user, "alan:imageGenerator"),
            imageModificator: imageModifier !== "none" ? `controlnet-${imageModifier}` : imageModifier,
            searchEngine: this.bot.db.settings.get(user, "alan:searchEngine"),
            photodescription: image.output && image.output.prompt ? image.output.prompt : null,
            photo: image.output && image.output.url ? image.output.url : image.input ? image.input.url : undefined,
            videoGenerator: "none",
            pluginList: plugins
        };

        /* Make the request to OpenAI's API. */
        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            const abortTimer: NodeJS.Timeout = setTimeout(() => {
                controller.abort();
                reject(new TypeError("Request timed out"));
            }, 90 * 1000);

            try {
                await fetchEventSource(this.url("text/alan/chatgpt"), {
                    headers: this.headers() as any,
                    body: JSON.stringify(body),
                    mode: "cors",
                    signal: controller.signal,
                    method: "POST",

                    onclose: () => {
                        if (!done) {
                            done = true;

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
                            const error = await this.error(response, "text/alan/chatgpt", true);

                            controller.abort();
                            reject(error);
                        }
                    },

                    onmessage: async (event) => {        
                        /* Response data */
                        const data: TuringAlanResult = JSON.parse(event.data);
                        if (!data || !data.result) return;

                        latest = data;
                        if (progress !== undefined) progress(latest);
                    },
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
            prompt: options.prompt,
            chat: options.raw
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
        return `http://212.227.227.178:3231/${path}`;
    }

    private async error(response: Response, path: TuringAPIPath, dry: true): Promise<GPTAPIError>;
    private async error(response: Response, path: TuringAPIPath, dry?: false): Promise<void>;

    private async error(response: Response, path: TuringAPIPath, dry?: boolean): Promise<GPTAPIError | void> {
        const body: any | null = await response.json().catch(() => null);
    
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