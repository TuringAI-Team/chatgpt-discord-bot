import { BaseGuildTextChannel, ChannelType, Collection, Interaction, TextBasedChannel, TextChannel, User } from "discord.js";
import fetch, { HeadersInit, Response } from "node-fetch";
import { EventEmitter } from "events";
import { Agent } from "https";

import { DatabaseImage, ImageGenerationCheckData, ImageGenerationOptions, ImageGenerationPrompt, ImageGenerationResult, ImageGenerationStatusData, RawImageGenerationResult, StableHordeGenerationResult } from "./types/image.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { StableHordeModel, STABLE_HORDE_AVAILABLE_MODELS, StableHordeConfigModel } from "./types/model.js";
import { StableHordeAPIError } from "../error/gpt/stablehorde.js";
import { StorageImage } from "../db/managers/storage.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

/* URL of all available Stable Diffusion models */
const SD_MODEL_URL: string = "https://raw.githubusercontent.com/db0/AI-Horde-image-model-reference/main/stable_diffusion.json"

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

export class ImageManager extends EventEmitter {
    private readonly bot: Bot;

    /* Available Stable Diffusion models */
    public readonly models: Collection<string, StableHordeModel>;

    constructor(bot: Bot) {
        super();

        this.bot = bot;
        this.models = new Collection();
    }

    public get(id: string): StableHordeModel | null {
        if (!STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === id)) return null;

        const matches: ((model: StableHordeModel, config: StableHordeConfigModel) => boolean)[] = [
            model => model.name === id,
            (_, config) => config.name === "a",
            model => model.description.includes(id)
        ]

        for (const model of this.models.values()) {
            const config: StableHordeConfigModel = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === id)!;
            
            for (const match of matches) {
                if (match(model, config)) return model;
                else continue;
            }
        }

        return null;
    }

    /**
     * Fetch all available Stable Diffusion models.
     */
    public async fetchModels(): Promise<void> {
        const response = await fetch(SD_MODEL_URL);
        const body: { [key: string]: StableHordeModel } = await response.json() as any;

        for (const [ name, { description, nsfw, summary, showcases } ] of Object.entries(body)) {
            this.models.set(name, {
                description, name, nsfw, summary, showcases
            });
        }
    }

    public getModels(query?: string): StableHordeModel[] {
        return Array.from(this.models.values())
            .filter(model => STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name))
            .filter(model => query ? model.description.toLowerCase().includes(query) || model.name.toLowerCase().includes(query) : true);
    }

    /**
     * Get a nicely-formatted display name for the specified model.
     * @returns Formatted display name
     */
    public displayNameForModel(model: StableHordeModel): string {
        const overwrite = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name) ?? null;
        if (overwrite !== null && overwrite.displayName) return overwrite.displayName;

        return Utils.titleCase(model.name.replaceAll("_", " "));
    }

    /**
     * Get a nicely-formatted description for the specified model.
     * @returns Formatted description
     */
    public descriptionForModel(model: StableHordeModel): string {
        const overwrite = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name) ?? null;
        if (overwrite !== null && overwrite.description) return overwrite.description;

        return model.description;
    }

    /**
     * Whether the specified model is marked as NSFW.
     * @returns Whether it is marked as NSFW
     */
    public isModelNSFW(model: StableHordeModel): boolean {
        const overwrite = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name) ?? null;
        if (overwrite !== null && overwrite.nsfw != undefined) return overwrite.nsfw;

        return model.nsfw;
    }

    /**
     * Whether the specified model can be shown in a Discord channel.
     * @returns Whether it can be shown
     */
    public shouldShowModel(interaction: Interaction, model: StableHordeModel): boolean {
        const overwrite = STABLE_HORDE_AVAILABLE_MODELS.find(m => m.name === model.name) ?? null;
        if (overwrite !== null && overwrite.nsfw != undefined) return !overwrite.nsfw;

        if (interaction.channel === null || interaction.channel.type === ChannelType.DM) return true;
        if (interaction.channel.type !== ChannelType.GuildText && model.nsfw) return false;

        if (interaction.channel.type === ChannelType.GuildText && interaction.channel.nsfw && model.nsfw) return true;
        else if (interaction.channel.type === ChannelType.GuildText && !interaction.channel.nsfw && model.nsfw) return false;

        return true;
    }

    public shouldShowNSFW(channel: TextBasedChannel): boolean {
        if (channel instanceof BaseGuildTextChannel) return channel.nsfw;
        else return true;
    }

    public displayPrompt(prompt: ImageGenerationPrompt, length: number = 90): string {
        return `${prompt.ai ? "🤖 " : ""}${Utils.truncate(Utils.removeTrailing(prompt.tags ? prompt.prompt.replace(prompt.tags, "").trim() : prompt.prompt.trim(), ","), length)}`; 
    }

    public async getImageData(image: ImageGenerationResult): Promise<StorageImage> {
        const storage: StorageImage = await this.bot.db.storage.fetchImage(image, "images");

        return {
            url: storage.url
        };
    }

    /**
     * Fetch all models & set up the request manager for Stable Horde.
     */
    public async setup(): Promise<void> {
        await this.fetchModels();
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

    public async cancelImageGeneration<T extends string>(id: string, reason: T): Promise<void> {
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
    public async generate({ nsfw, model, params, prompt, shared, priority }: ImageGenerationOptions, progress?: (data: ImageGenerationCheckData) => Promise<void | void>, updateInterval: number = 3000): Promise<StableHordeGenerationResult> {
        const before: number = Date.now();

        /* Start the image generation request. */
        const { id } = await this.startImageGeneration({
            nsfw, censor_nsfw: !nsfw,
            r2: true, shared: shared ?? false, trusted_workers: false, jobId: "", failed: false, gathered: false,

            params: params,

            prompt: prompt.negative != undefined ? `${prompt.prompt} ### ${prompt.negative}` : prompt.prompt,
            models: [ model.name ],
            index: 0
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
        return `ChatGPT-Discord-Bot:999:Discord->f1nniboy#2806`;
    }

    public headers(anon: boolean): HeadersInit {
        return {
            apikey: anon ? "0000000000" : this.bot.app.config.stableHorde.key,
            "Client-Agent": this.clientAgent()
        };
    }
}