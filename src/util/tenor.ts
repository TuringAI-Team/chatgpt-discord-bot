import { inspect } from "util";

import { GPTAPIError } from "../error/api.js";
import { Bot } from "../bot/bot.js";

type TenorAPIPath = "search" | "posts"

export type TenorMediaType = "nanowebm" | "nanomp4" | "tinymp4" | "gif" | "mp4" | "ebm" | "nanogif" | "mediumgif" | "tinygif" | "tinywebm" | "loopedmp4"

export interface TenorMedia {
    size: number;
    url: string;
    preview: string;
}

export interface TenorRawGIF {
    id: string;
    title: string;
    content_description: string;
    itemurl: string;
    media_formats: Record<TenorMediaType, TenorMedia>;
}

export interface TenorGIF {
    /* ID of the GIF */
    id: string;

    /* URL to the GIF's page */
    url: string;

    /* Description of the GIF */
    title: string;

    /* All media types of this GIF */
    media: Record<TenorMediaType, TenorMedia>;
}

interface TenorSearchOptions {
    query: string;
    max?: number;
}

export class TenorAPI {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    private rawToGIF({ id, media_formats, content_description, itemurl }: TenorRawGIF): TenorGIF {
        return {
            id,
            media: media_formats,
            title: content_description,
            url: itemurl
        };
    }

    public async info(id: string): Promise<TenorGIF | null>;
    public async info(id: string[]): Promise<TenorGIF[]>;

    public async info(id: string | string[]): Promise<(TenorGIF | null) | TenorGIF[]> {
        const ids: string[] = typeof id === "object" ? id : [ id ];
        const arr: boolean = typeof id === "object";

        const response: { results: TenorRawGIF[] } = await this.request("posts", {
            ids: ids.join(",")
        });

        if (response.results.length === 0) return arr ? [] : null;

        return arr
            ? response.results.map(raw => this.rawToGIF(raw))
            : this.rawToGIF(response.results[0]);
    }

    public async search(options: TenorSearchOptions): Promise<TenorGIF[]> {
        const { query, max }: Required<TenorSearchOptions> = {
            ...options, max: 10
        };

        const response: { results: TenorRawGIF[] } = await this.request("search", {
            limit: max.toString(),
            q: query
        });

        if (response.results.length === 0) return [];
        return response.results.map(raw => this.rawToGIF(raw));
    }

    private async request<T>(path: TenorAPIPath, data?: { [key: string]: any }): Promise<T> {
        /* Convert the options & the base headers into URL parameters. */
        const params: string = new URLSearchParams({
            ...data ?? {},
            ...this.headers()
        }).toString();

        /* Make the actual request. */
        const response = await fetch(`${this.url(path)}?${params}`, {
            headers: this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (!response.ok || (await response.clone().json().catch(() => null))?.error) await this.error(response, path);

        /* Get the response body. */
        const body: T = await response.json().catch(() => null) as T ?? await response.text() as T;
        return body;
    }

    private url(path: TenorAPIPath): string {
        return `https://tenor.googleapis.com/v2/${path}`;
    }

    private async error(response: Response, path: TenorAPIPath): Promise<GPTAPIError | void> {
        const body: any | null = await response.json().catch(() => null);
    
        const error: GPTAPIError = new GPTAPIError({
            code: body && body.error ? 400 : response.status,
            message: body && body.error ? inspect(body.error.toString(), { depth: 1 }) : null,
            endpoint: `/${path}`,
            id: null
        });

        throw error;
    }

    private headers(): { [key: string]: string } {
        return {
            key: this.bot.app.config.gif.tenor
        };
    }
}