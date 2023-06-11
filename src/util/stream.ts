import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import { Awaitable } from "discord.js";

import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { GPTAPIError } from "../error/gpt/api.js";

type StreamSetFunction<PartialResponseData> = (value: PartialResponseData) => void

export interface StreamBuilderOptions<RequestBody, PartialResponseData, FinalResponseData = PartialResponseData, ProcessedFinalResponseData = FinalResponseData> {
    /* Which URL to request */
    url: string;

    /* The entire request body to send */
    body: RequestBody;

    /* All headers to use */
    headers: Record<string, string | number | boolean> | HeadersInit;

    /* The error handler to use */
    error: (response: Response) => Awaitable<Error | null>;

    /* The progress handler to use */
    progress?: (data: PartialResponseData, old: PartialResponseData | null, set: StreamSetFunction<PartialResponseData>) => Awaitable<void>;

    /* Check callback, to determine whether progress() should be called */
    check?: (data: PartialResponseData) => Awaitable<boolean>;

    /* Process & transform the final data */
    process?: (data: FinalResponseData) => Awaitable<ProcessedFinalResponseData>;

    /* How long to wait, until the request automatically gets aborted after inactivity, in seconds */
    duration?: number;
}

export class StreamBuilder<RequestBody, PartialResponseData, FinalResponseData = PartialResponseData, ProcessedFinalResponseData = FinalResponseData> {
    /* Various stream builder options */
    private readonly options: StreamBuilderOptions<any, any> & Required<Omit<StreamBuilderOptions<any, any>, "process" | "progress">>;

    constructor(options: StreamBuilderOptions<RequestBody, PartialResponseData, FinalResponseData, ProcessedFinalResponseData>) {
        this.options = {
            duration: 0, check: () => true,
            ...options
        };
    }

    public async run(): Promise<ProcessedFinalResponseData> {
        /* Latest message of the stream */
        let latest: PartialResponseData | null = null;

        /* Whether the generation is finished */
        let done: boolean = false;

        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            const abortTimer: NodeJS.Timeout | null = this.options.duration > 0 ? setTimeout(() => {
                controller.abort();
                reject(new TypeError("Request timed out"));
            }, this.options.duration * 1000) : null;

            const setFunction: StreamSetFunction<PartialResponseData> =
                value => latest = value;

            try {
                await fetchEventSource(this.options.url, {
                    headers: this.options.headers as any,
                    body: JSON.stringify(this.options.body),
                    signal: controller.signal,
                    method: "POST",
                    mode: "cors",

                    onclose: () => {
                        if (!done) {
                            done = true;

                            controller.abort();
                            resolve();
                        }
                    },
                    
                    onerror: (error) => {
                        if (abortTimer) clearTimeout(abortTimer);
                        throw error;
                    },
        
                    onopen: async (response) => {
                        if (abortTimer) clearTimeout(abortTimer);

                        /* If the request failed for some reason, throw an exception. */
                        if (response.status !== 200) {
                            const error = await this.options.error(response);

                            controller.abort();
                            reject(error);
                        }
                    },

                    onmessage: async (event) => {
                        /* Response data */
                        const data: PartialResponseData = JSON.parse(event.data);
                        if (!data || !(await this.options.check(data))) return;

                        try {
                            const old = latest;
                            latest = data;

                            if (this.options.progress) this.options.progress(data, old, setFunction);
                        } catch (error) {
                            throw error;
                        }
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
            type: GPTGenerationErrorType.Moderation
        });

        /* Final (processed) data */
        let final: ProcessedFinalResponseData = latest as ProcessedFinalResponseData;
        if (this.options.process) final = await this.options.process(final);

        return final;
    }
}