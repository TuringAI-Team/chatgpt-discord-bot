import { setTimeout as delay } from "timers/promises";
import { Awaitable } from "discord.js";

import { RunPodMusicGenInput, RunPodMusicGenOutput, RunPodMusicGenResult } from "./models/musicgen.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { RunPodBLIP2Input, RunPodBLIP2Output } from "./models/blip2.js";
import { ImageBuffer } from "../chat/types/image.js";
import { Bot } from "../bot/bot.js";

export type RunPodPath = "runsync" | "run" | `status/${string}`

/* Available RunPod models */
type RunPodModel = "blip2" | "musicgen"

type RunPodExecutionStatus = "COMPLETED" | "IN_PROGRESS" | "IN_QUEUE" | "FAILED"

interface RunPodExecuteOptions<T> {
    /* Which model to run */
    model: RunPodModel;

    /* Input data to use for the model */
    input: T;
}

type RunPodStreamExecuteOptions<T, U> = RunPodExecuteOptions<T> & {
    progress?: (data: RunPodRawStreamResponseData<U>) => Awaitable<void>;
    interval?: number;
}

interface RunPodRawSyncResponseData<T> {
    delayTime: number;
    executionTime: number;
    id: string;
    output: T;
    status: RunPodExecutionStatus;
    error?: string;
}

export interface RunPodRawStreamResponseData<T> {
    delayTime?: number;
    executionTime?: number;
    id: string;
    output?: T;
    error?: string;
    status: RunPodExecutionStatus;
}

export interface RunPodResult<T> {
    duration: number;
    output: T;
}

export class RunPodManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public async execute<InputData = any, OutputData = any>({ model, input }: RunPodExecuteOptions<InputData>): Promise<RunPodResult<OutputData>> {
        const data: RunPodRawSyncResponseData<OutputData> = await this.bot.turing.request({
            path: "runpod/runsync", method: "POST", body: {
                model, input
            }
        });

        this.error(data);

        return {
            duration: data.executionTime,
            output: data.output
        };
    }

    public async stream<InputData = any, OutputData = any>({ model, input, interval, progress }: RunPodStreamExecuteOptions<InputData, OutputData>): Promise<RunPodResult<OutputData>> {
        let latest: RunPodRawStreamResponseData<OutputData> = await this.bot.turing.request({
            path: "runpod/run", method: "POST", body: {
                model, input
            }
        });

        do {
            latest = await this.bot.turing.request({
                path: `runpod/status/${latest.id}`, method: "POST", body: {
                    model
                }
            });

            this.error(latest);
            
            if (progress && latest.status !== "COMPLETED" && latest.status !== "FAILED") {
                try {
                    await progress(latest);
                } catch (_) {}
            }

            await delay(interval ?? 5000);
        } while (latest.status !== "COMPLETED" && latest.status !== "FAILED");

        if (!latest.delayTime || !latest.executionTime || !latest.output) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Empty
        });

        return {
            duration: latest.executionTime,
            output: latest.output
        };
    }

    public async blip2(input: RunPodBLIP2Input): Promise<RunPodResult<RunPodBLIP2Output>> {
        return this.execute({ model: "blip2", input });
    }

    public async musicGen(input: RunPodMusicGenInput, progress?: (data: RunPodRawStreamResponseData<RunPodMusicGenOutput>) => Awaitable<void>): Promise<RunPodMusicGenResult> {
        const result: RunPodResult<RunPodMusicGenOutput> = await this.stream({ model: "musicgen", input, progress });

        return {
            results: result.output.output.map(data => ImageBuffer.load(data)),
            raw: result
        };
    }

    private error(data: RunPodRawSyncResponseData<any> | RunPodRawStreamResponseData<any>): void {
        if (data.status !== "FAILED" || !data.error) return;

        throw new GPTGenerationError({
            type: GPTGenerationErrorType.Other,
            data: data.error
        });
    }
}