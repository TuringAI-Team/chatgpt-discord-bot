import { BaseGuildTextChannel, ChannelType, Collection, Interaction, TextBasedChannel, User } from "discord.js";
import fetch, { HeadersInit, Response } from "node-fetch";
import { EventEmitter } from "events";
import { Agent } from "https";

import { DatabaseImage, ImageGenerationCheckData, ImageGenerationOptions, ImageGenerationPrompt, ImageGenerationResult, ImageGenerationStatusData, RawImageGenerationResult, StableHordeGenerationResult } from "./types/image.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { StableHordeModel, StableHordeConfigModels } from "./types/model.js";
import { StableHordeAPIError } from "../error/gpt/stablehorde.js";
import { StorageImage } from "../db/managers/storage.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

type StableHordeAPIPath = "find_user" | "status/models" | "generate/async" | `generate/check/${string}` | `generate/status/${string}` | `generate/rate/${string}`

interface StableHordeGenerateAPIResponse {
    /* Identifier of the started generation process */
    id: string;
}

interface StableHordeRatingBody {
    /* Best image out of all generations */
    best: string;

    /* Individual image ratings */
    ratings: {
        /* Identifier of the individual image */
        id: string;

        /* Rating, 1-10 */
        rating: number;

        /* Artifacts, 1-5 */
        artifacts: number;
    }[];
}

interface StableHordeKudosDetails {
    accumulated: number;

    /* Kudos gifted by other users */
    gifted: number;

    /* Kudos received from admins */
    admin: number;

    /* Donations received from other users */
    received: number;

    /* Recurring kudos payments, e.g. from a Patreon subscription */
    recurring: number;

    /* Kudos awarded from rating images */
    awarded: number;
}

interface StableHordeRecordDetails {
    request: {
        image: number;
        text: number;
        interrogation: number;
    }
}

interface StableHordeFindUserAPIResponse {
    /* Name of the user */
    username: string;

    /* ID of the user */
    id: number;

    /* Total kudos of the user */
    kudos: number;

    /* Further information about the user's kudos */
    kudos_details: StableHordeKudosDetails;

    /* Information about the user's usage of Stable Horde */
    records: StableHordeRecordDetails;
}

interface StableHordeRatingAPIResponse {
    /* How many kudos were rewarded to the account */
    reward: number;
}

type StableHordeCancelReason = "button" | "timeOut"

class ImageModelHelper {
    private readonly manager: ImageManager;

    constructor(manager: ImageManager) {
        this.manager = manager;
    }

    private get(id: StableHordeModel | string): StableHordeModel {
        if (typeof id === "object") return id;
        else return this.manager.get(id)!;
    }

    public nsfw(id: StableHordeModel | string): boolean {
        const model = this.get(id);
        return model.nsfw;
    }

    public description(id: StableHordeModel | string): string {
        const model = this.get(id);
        return model.description;
    }

    public name(id: StableHordeModel | string): string {
        const model = this.get(id);
        return model.name ?? model.id;
    }

    public usable(id: StableHordeModel | string, interaction: Interaction): boolean {
        const model = this.get(id);
        const nsfw: boolean = this.nsfw(model);

        if (interaction.channel === null || interaction.channel.type === ChannelType.DM) return true;
        if (interaction.channel.type !== ChannelType.GuildText && nsfw) return false;

        if (interaction.channel instanceof BaseGuildTextChannel && interaction.channel.nsfw && nsfw) return true;
        else if (interaction.channel instanceof BaseGuildTextChannel && !interaction.channel.nsfw && nsfw) return false;

        return true;
    }

    public display(id: StableHordeModel | string): string {
        const model = this.get(id);
        return `${this.name(model)}${this.nsfw(model) ? " 🔞" : ""} » ${this.description(model)}`;
    }
}

export class ImageManager extends EventEmitter {
    private readonly bot: Bot;

    /* Available Stable Diffusion models */
    public readonly models: Collection<string, StableHordeModel>;

    /* Helper with models */
    public readonly model: ImageModelHelper;

    constructor(bot: Bot) {
        super();

        this.bot = bot;
        this.models = new Collection();

        this.model = new ImageModelHelper(this);
    }

    public get(id: string): StableHordeModel | null {
        if (!StableHordeConfigModels.find(m => m.id === id)) return null;

        const matches: ((model: StableHordeModel) => boolean)[] = [
            model => model.id === id,
            model => model.name === id
        ]

        for (const model of this.models.values()) {            
            for (const match of matches) {
                if (match(model)) return model;
                else continue;
            }
        }

        return null;
    }

    public nsfw(channel: TextBasedChannel): boolean {
        if (channel instanceof BaseGuildTextChannel) return channel.nsfw;
        else return true;
    }

    public displayPrompt(prompt: ImageGenerationPrompt, length: number = 250): string {
        return Utils.truncate(Utils.removeTrailing(prompt.tags ? prompt.prompt.replace(prompt.tags, "").trim() : prompt.prompt.trim(), ","), length); 
    }

    public async getImageData(image: ImageGenerationResult): Promise<StorageImage> {
        const storage: StorageImage = await this.bot.db.storage.fetchImage(image, "images");

        return {
            url: storage.url
        };
    }

    /**
     * Set up all models for Stable Horde.
     */
    public async setup(): Promise<void> {
        for (const raw of StableHordeConfigModels) {
            const final: StableHordeModel = {
                name: null, tags: [], premium: false, ...raw
            }

            this.models.set(raw.id, final);
        }
    }

    public async findUser(): Promise<StableHordeFindUserAPIResponse> {
        return this.request<StableHordeFindUserAPIResponse>("find_user", "GET");
    }

    public async rateImage(id: string, data: StableHordeRatingBody): Promise<StableHordeRatingAPIResponse> {
        return this.request<StableHordeRatingAPIResponse>(`generate/rate/${id}`, "POST", data);
    }

    private async startImageGeneration(options: any, anon: boolean): Promise<StableHordeGenerateAPIResponse> {
        return this.request<StableHordeGenerateAPIResponse>("generate/async", "POST", options, anon);
    }

    private async checkImageGeneration(id: string, anon: boolean): Promise<ImageGenerationCheckData> {
        return {
            ...await this.request<ImageGenerationCheckData>(`generate/check/${id}`, "GET", undefined, anon),
            id
        };
    }

    private async getImageGenerationStatus(id: string): Promise<ImageGenerationStatusData> {
        return this.request<ImageGenerationStatusData>(`generate/status/${id}`, "GET");
    }

    public async cancelImageGeneration(id: string, reason: StableHordeCancelReason): Promise<void> {
        this.emit("cancelled", id, reason);
        await this.request(`generate/status/${id}`, "DELETE");
    }

    /**
     * Check whether an image generation request got cancelled already.
     * @param data /generate/check/{id} API response
     * 
     * @returns Whether it was cancelled
     */
    public isImageGenerationCancelled(data: ImageGenerationCheckData): boolean {
        return !data.done && (data.finished + data.processing + data.restarted + data.waiting + data.kudos + data.wait_time + data.queue_position) === 0;
    }

    /**
     * Generate an image using Stable Horde.
     * 
     * @param options Image generation options
     * @param progress Where to send partial results to
     * 
     * @returns Finished generation result 
     */
    public async generate({ nsfw, model, params, prompt, shared, priority, source }: ImageGenerationOptions, progress?: (data: ImageGenerationCheckData) => Promise<void | void>, updateInterval: number = 5000): Promise<StableHordeGenerationResult> {
        const before: number = Date.now();

        /* Img2Img input image */
        let sourceBuffer: ImageBuffer | null = null;

        /* Fetch the source input image, if applicable. */
        if (source !== null) {
            sourceBuffer = await Utils.fetchBuffer(source.url);
        }

        /* Start the image generation request. */
        const { id } = await this.startImageGeneration({
            nsfw, censor_nsfw: !nsfw,
            r2: true, shared: shared ?? false, trusted_workers: false, jobId: "", failed: false, gathered: false,

            params: params,

            prompt: prompt.negative ? `${prompt.prompt} ### ${prompt.negative}` : prompt.prompt,
            models: [ model.id ],
            index: 0,
            
            source_image: sourceBuffer !== null ? sourceBuffer.toString() : undefined,
            source_processing: sourceBuffer !== null ? "img2img" : undefined
        }, !priority);

        /* Latest /generate/check update */
        let latest: ImageGenerationCheckData = null!;

        await new Promise<void>(async (resolve, reject) => {
            /* Image generation cancel listener */
            const listener = (cancelledID: string, reason: string) => {
                if (id !== cancelledID) return;

                clearInterval(interval);
                reject(new GPTGenerationError<string>({ type: GPTGenerationErrorType.Cancelled, data: reason }));

                this.off("cancelled", listener);
            }

            const interval: NodeJS.Timer = setInterval(async () => {
                try {
                    /* Fetch the latest status about the generation process. */
                    latest = await this.checkImageGeneration(id, !priority);

                    /* If the request was cancelled, ignore this interval check. */
                    if (this.isImageGenerationCancelled(latest)) return;

                    /* Once the generation has finished, exit this interval & fetch the final results. */
                    if (latest.done) {
                        this.off("cancelled", listener);
                        clearInterval(interval);

                        return resolve();
                    }

                    if (progress) progress(latest);

                } catch (error) {
                    this.off("cancelled", listener);
                    clearInterval(interval);
                    
                    return reject(error);
                }
            }, updateInterval);

            this.on("cancelled", listener);
        });

        /* If there was no status progress at all, throw an error. */
        if (latest === null) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        /* Fetch the final results. */
        const data = await this.getImageGenerationStatus(id);

        /* Fetch all the generated images, and convert them to a buffer. */
        const images: ImageGenerationResult[] = await Promise.all(data.generations.map(async ({ censored, id, seed, img }: RawImageGenerationResult) => {
            return {
                censored, id, seed, url: img
            };
        }));
        
        return {
            images: images,
            kudos: data.kudos,

            id, duration: Date.now() - before,

            completed: Date.now(),
            requested: before
        };
    }

    public toDatabase(author: User, options: ImageGenerationOptions, prompt: ImageGenerationPrompt, result: StableHordeGenerationResult, nsfw: boolean): DatabaseImage {
        return {
            id: result.id,
            author: author.id,
            requested: new Date(result.requested).toISOString(),
            completed: new Date(result.completed).toISOString(),
            options: options,
            rating: null,
            results: result.images,
            cost: result.kudos,
            prompt,
            nsfw
        };
    }

    private async request<T>(path: StableHordeAPIPath, method: "GET" | "POST" | "DELETE" = "GET", data?: { [key: string]: any }, anon: boolean = false): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: {
                ...this.headers(anon),
                "Content-Type": "application/json"
            },

            agent: new Agent({ timeout: 120 * 1000 })
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.status.toString().startsWith("2")) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.json() as T;
        return body;
    }

    private url(path: StableHordeAPIPath): string {
        return `https://stablehorde.net/api/v2/${path}`;
    }

    private async error(response: Response, path: StableHordeAPIPath): Promise<void> {
        const body: any | null = await response.json().catch(() => null);
    
        throw new StableHordeAPIError({
            code: response.status,
            endpoint: `/${path}`,
            id: null,
            message: body !== null && body.message ? body.message : null
        });
    }

    private clientAgent(): string {
        return `Turing:999:discord.gg/turing`;
    }

    public headers(anon: boolean): HeadersInit {
        return {
            apikey: anon ? "0000000000" : this.bot.app.config.stableHorde.key,
            "Client-Agent": this.clientAgent()
        };
    }
}