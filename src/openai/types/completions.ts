/**
 * POST https://api.openai.com/v1/completions
 * https://platform.openai.com/docs/api-reference/completions
 */
export interface OpenAICompletionsBody {
    /** ID of the model to use */
    model?: string;

    /** The prompt to generate the completion for */
    prompt: string;

    /** What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. */
    temperature?: number;

    /** An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered  */
    top_p?: number;

    /** Maximum number of tokens to generate in the completion */
    max_tokens?: number;

    /** Number between -2.0 and 2.0, positive values penalize new tokens based on whether they appear in the text so far, increasing the model's likelihood to talk about new topics */
    presence_penalty?: number;
    frequency_penalty?: number;

    /** Likelihood of specific tokens appearing in the generated output, between -100 and 100 */
    logit_bias?: {
        [token: number]: number;
    };

    /* Whether the response should be streamed */
    stream: true;

    /* Unique user identifier, used by OpenAI to track down violating requests */
    user?: string;

    /** List of strings to stop the generation on */
    stop?: string[] | string;
}

export interface OpenAICompletionsJSON {
    choices: OpenAICompletionResponse[];
    usage: OpenAIUsageCompletionsData;
}

export interface OpenAIUsageCompletionsData {
    prompt_tokens: number;
    completion_tokens: number;

    /** How many tokens were used in total */
    total_tokens: number;
}

export interface OpenAICompletionResponse {
    /** Generated text */
    text: string;

    /** Reason for halting the generation */
    finish_reason: "stop" | "length" | "max_tokens";
}

export interface OpenAICompletionsData {
    /** How many tokens were used for the generation */
    usage: OpenAIUsageCompletionsData;

    /** Generated response */
    response: OpenAICompletionResponse;
}