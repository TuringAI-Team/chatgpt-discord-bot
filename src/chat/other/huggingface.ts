import { getPromptLength } from "../../conversation/utils/length.js";
import { OpenAIChatMessage } from "../../openai/types/chat.js";
import { GPTAPIError } from "../../error/gpt/api.js";
import { Bot } from "../../bot/bot.js";
import { MessageStopReason } from "../types/message.js";

export type HFModel = "OpenAssistant/oasst-sft-1-pythia-12b";

interface HFCompleteOptions {
    /* Input to complete */
    content: string;

    /* Model to use text inference for */
    model: HFModel;
}

interface HFGenerateOptions {
    /* Messages for the chat history */
    messages: HFMessage[];

    /* Progress callback, to receive partial generated messages */
    progress: (response: HFResponse) => Promise<void> | void;

    /* Which model to use */
    model: HFModel;

    /* How many tokens the response should have at most */
    maxTokens: number;
}

type HFMessage = OpenAIChatMessage

export interface HFResponse {
    /* Generated response */
    content: string;

    /* Why the generation was stopped */
    finishReason: MessageStopReason | null;
}

export type HFPartialResponse = HFResponse

export type HFResponseJSON = [
    {
        generated_text: string;
    }
]

interface HFErrorData {
    error: string;
}

const HF_BASE_URL: string = "https://api-inference.huggingface.co/models"

export class HuggingFaceAPI {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /**
     * Complete the specified prompt using the inference API, until it reaches the length limit.
     * @param options Completion options
     * 
     * @returns Completed response
     */
    private async complete({ content, model }: HFCompleteOptions): Promise<HFResponse> {
        const response = await fetch(`${HF_BASE_URL}/${model}`, {
            body: JSON.stringify({ inputs: content }),
            headers: this.headers(),
            method: "POST"
        });
        
        if (response.status !== 200) {
            const error: GPTAPIError = await this.error(response);
            throw error;
        }

        /* Response body */
        const data: HFResponseJSON = await response.json();
        
        return {
            content: data[0].generated_text.replace(content, ""),
            finishReason: null
        };
    }

    /**
     * Generate a response for the specified message history, and prompt.
     * @param options Generation options 
     * 
     * @returns Generated response
     */
    public async runTextInference({ messages, progress, model, maxTokens }: HFGenerateOptions): Promise<HFResponse> {
        /* Completed responses */
        const completions: HFResponse[] = [];
        let latest: HFResponse | null = null;
        
        /* Possible reason for stopping the generation */
        let finishReason: MessageStopReason | null = null;

        /* Raw formatted prompt */
        let raw: string = messages.map(message => `<|${message.role === "user" ? "prompter" : "assistant"}|>${message.content}<|endoftext|>`).join("");
        raw = `${raw}<|assistant|>`;

        /* Concatenate the various HuggingFace responses together. */
        const concat = (responses: HFResponse[]): HFResponse => ({ content: responses.map(r => r.content).join("") ?? "", finishReason: null });

        /* Total tokens of the generation so far */
        let tokens: number = 0;

        do {
            const previous: HFResponse = concat(completions);
            tokens = getPromptLength(previous.content);

            const result: HFResponse = await this.complete({ content: `${raw}${previous.content}`, model });

            if (result.content.trim().length > 0) {
                completions.push(result);
                progress(concat(completions));
            }

            latest = result;
        } while (latest === null || (latest !== null && latest.content.trim().length > 0) && tokens < maxTokens);

        if (tokens >= maxTokens) finishReason = "maxLength";
        
        return {
            ...concat(completions),
            finishReason
        };
    }

    private async error(response: Response): Promise<GPTAPIError> {
        /* Error data */
        let body: HFErrorData | null = null;

        /* Try to parse the given error data in the response. */
        try {
            body = await response.json() as HFErrorData;
        } catch (error ) {
            body = null;
        }

        return new GPTAPIError({
            endpoint: response.url,
            code: response.status,
            id: null,
            message: body !== null ? body.error : null
        });
    }

    private headers(): HeadersInit {
        return {
            Cookie: `token=${this.bot.app.config.huggingFace.key}`,
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36 Edg/112.0.0.0",
            "Content-Type": "application/json"
        };
    }
}