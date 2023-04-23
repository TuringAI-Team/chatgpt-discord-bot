import { fetchEventSource } from "@waylaidwanderer/fetch-event-source";
import { Collection } from "discord.js";

import { GPTGenerationError, GPTGenerationErrorType } from "../../error/gpt/generation.js";
import { GPTAPIError } from "../../error/gpt/api.js";
import { Bot } from "../../bot/bot.js";

interface NatModelParameter {
    value: number | string | Array<string | number>;
    
    range: [
        number | string,
        number | string
    ];
}

export interface NatModel {
    /* Name of the model, e.g. `gpt-4` */
    name: string;

    /* Tag of the model, e.g. `openai:gpt4` */
    tag: string;

    /* Version/variation of the model, e.g. `vanilla` */
    version?: string;

    /* Parameters of the model */
    parameters: { [key: string]: NatModelParameter };

    /* Which service is providing this model, e.g. `openai` */
    provider: string;
}

type NatAPIPath = "all_models" | "stream"

type NatModelsBody = { [model: string]: Omit<NatModel, "tag"> }
type NatRequestModelParameters = { [key: string]: Array<string | number> | number | string | null | undefined }

type NatRequestModel = Pick<NatModel, "name" | "provider" | "tag"> & {
    /* Model request parameters */
    parameters: NatRequestModelParameters;

    /* ... */
    enabled: true;
    selected: true;
}

interface NatStreamRequestJSON {
    models: [ NatRequestModel ]
    prompt: string;
}

export interface NatPartialResponseJSON {
    message: string;

    modelName: string;
    modelTag: string;
}

interface NatResponse {
    /* Completed response */
    content: string;
}

interface NatErrorData {
    status: string;
}

interface NatGenerationOptions {
    /* Model to use */
    model: NatModel;

    /* Parameters for the model */
    parameters: NatRequestModelParameters;

    /* Prompt to complete */
    prompt: string;

    /* Partial callback, to receive partial completion events */
    progress?: (data: NatPartialResponseJSON) => Promise<void> | void;
}

export class NatAI {
    private readonly bot: Bot;

    /* Collection of all Nat playground models */
    private readonly models: Collection<string, NatModel>;

    constructor(bot: Bot) {
        this.bot = bot;
        this.models = new Collection();
    }

    /**
     * Set the Clerk authentication manager & all available models up.
     */
    public async setup(): Promise<void> {
        await this.fetchModels();
    }

    /**
     * Fetch all Nat playground models, and load them into a collection.
     */
    private async fetchModels(): Promise<void> {
        const response: NatModelsBody = await this.request<NatModelsBody>("all_models", "GET");

        /* Load all the models. */
        for (const [ name, data ] of Object.entries(response)) {
            this.models.set(name, {
                ...data,
                tag: name
            });
        }
    }

    /**
     * Get a specific model, in the collection.
     * @param name Name of the model
     * 
     * @throws An error, if the model couldn't be found
     * @returns The requested model
     */
    public model(name: string): NatModel {
        const model: NatModel | null = this.models.get(name) ?? null;
        if (model === null) throw new Error("Invalid playground model was specified");

        return model;
    }

    /**
     * Make the specified model usable for the /stream endpoint.
     * @param model Model to convert
     * 
     * @returns Converted model
     */
    private convertModelToRaw(model: NatModel, parameters: NatRequestModelParameters): NatRequestModel {
        /* Parameters to pass to the model */
        let modelParameters: NatRequestModelParameters = parameters;

        for (const [name, data] of Object.entries(model.parameters)) {
            if (!modelParameters[name]) modelParameters[name] = data.value;
        }

        return {
            name: model.tag, provider: model.provider, tag: model.tag,
            parameters: modelParameters,

            enabled: true, selected: true
        };
    }

    public async generate(options: NatGenerationOptions): Promise<NatResponse> {
        /* Latest message of the stream */
        let latest: NatPartialResponseJSON | null = null!;

        /* Whether the generation is finished */
        let done: boolean = false;

        /* Make the request to OpenAI's API. */
        await new Promise<void>(async (resolve, reject) => {
            const controller: AbortController = new AbortController();

            try {
                await fetchEventSource(this.url("stream"), {
                    headers: {
                        ...await this.headers() as any,
                        "Content-Type": "text/plain;charset=UTF-8"
                    },

                    body: JSON.stringify({
                        models: [ this.convertModelToRaw(options.model, options.parameters) ],
                        prompt: options.prompt
                    } as NatStreamRequestJSON),

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
                        throw error;
                    },
        
                    onopen: async (response) => {
                        /* If the request failed for some reason, throw an exception. */
                        if (response.status !== 200) {
                            const error: Error = await this.error(response);

                            controller.abort();
                            reject(error);
                        }

                        if (response.status !== 200) {
                            /* Response data */
                            const data: any | null = await response.clone().json().catch(() => null);

                            controller.abort();
                            
            
                            /* If an error message was given in the response body, show it to the user. */
                            if (data !== null) {
                                const error: Error = await this.error(response);
                                reject(error);
                            }
                        }
                    },

                    onmessage: async (event) => {
                        /* Response data */
                        const data: NatPartialResponseJSON = JSON.parse(event.data);
                        if (data === null || data === undefined) return;

                        if (event.event === "status") {
                            /* If the request is finished, resolve the promise & mark the request as done. */
                            if (data.message === "[COMPLETED]") {
                                done = true;

                                controller.abort();
                                return resolve();

                            /* Otherwise, wait for the generation to start. */
                            } else if (data.message === "[INITIALIZING]") return;

                            /* If an error occured, stop generating. */
                            else if (data.message.startsWith("[ERROR]")) {
                                controller.abort();
                                
                                return reject(new GPTAPIError({
                                    code: 500,
                                    endpoint: "/stream",
                                    id: null,
                                    message: data.message.replace("[ERROR]", "").trim()
                                }));
                            }
                        }

                        latest = {
                            ...data,
                            message: latest !== null ? `${latest.message}${data.message}` : data.message
                        };

                        if (options.progress !== undefined && latest !== null) options.progress(latest);
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

        /* If the request was not finished, throw an error. */
        if (!done || latest === null) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return {
            content: (latest as NatPartialResponseJSON).message
        };
    }

    private async request<T>(path: NatAPIPath, method: "GET" | "POST", data?: { [key: string]: any }): Promise<T> {
        /* Make the actual request. */
        const response = await fetch(this.url(path), {
            method,
            
            body: data !== undefined ? JSON.stringify(data) : undefined,
            headers: await this.headers()
        });

        /* If the request wasn't successful, throw an error. */
        if (response.status !== 200) await this.error(response);

        /* Get the response body. */
        const body: T = await response.json();
        return body;
    }

    private async error(response: Response): Promise<GPTAPIError> {
        /* Error data */
        let body: NatErrorData | null = null;

        /* Try to parse the given error data in the response. */
        try {
            body = await response.json() as NatErrorData;
        } catch (error ) {
            body = null;
        }

        return new GPTAPIError({
            endpoint: response.url,
            code: response.status,
            id: null,
            message: body !== null ? body.status : null
        });
    }

    private url(path: NatAPIPath): string {
        return `https://nat.dev/api/${path}`;
    }

    private async headers(): Promise<HeadersInit> {
        return {
            Authorization: `Bearer ${this.bot.app.config.nat.token}`,
            Cookie: `__session=${this.bot.app.config.nat.token}; __client_uat=${this.bot.app.config.nat.auth.uat}`,

            "User-Agent": this.bot.app.config.nat.userAgent,
            "sec-ch-ua": `"Chromium";v="112", "Microsoft Edge";v="112", "Not:A-Brand";v="99"`,
            "baggage": "sentry-environment=dev,sentry-public_key=ba8762f0657a48cbb62daf5f4b68cc91,sentry-trace_id=5acfba835df84c3cb0e6a967972e2779,sentry-sample_rate=1",
            "sentry-trace": "2836bba00ead40e7a03f860799f6aa86-a7d4f78f05699223-1",
            "dnt": "1",
            "Origin": "https://nat.dev",
            "Referer": "https://nat.dev/"
        };
    }
}