import { Bot } from "../bot/bot.js";
import { RunPodBLIP2Input, RunPodBLIP2Output } from "./models/blip2.js";

export type RunPodPath = "runsync"

/* Available RunPod models */
type RunPodModel = "blip2"

type RunPodExecutionStatus = "COMPLETED"

interface RunPodExecuteOptions<T> {
    /* Which model to run */
    model: RunPodModel;

    /* Input data to use for the model */
    input: T;
}

interface RunPodRawResponseData<T> {
    delayTime: number;
    executionTime: number;
    id: string;
    output: T;
    status: RunPodExecutionStatus;
}

interface RunPodResult<T> {
    duration: number;
    output: T;
}

export class RunPodManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    public async execute<InputData = any, OutputData = any>({ model, input }: RunPodExecuteOptions<InputData>): Promise<RunPodResult<OutputData>> {
        const data: RunPodRawResponseData<OutputData> = await this.bot.turing.request("runpod/runsync", "POST", {
            model, input
        });

        return {
            duration: data.executionTime,
            output: data.output
        };
    }

    public async blip2(input: RunPodBLIP2Input): Promise<RunPodResult<RunPodBLIP2Output>> {
        return this.execute({ model: "blip2", input });
    }
}