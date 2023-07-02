export interface TuringOpenAIChatBody {
    /** ID of the model to use */
    model: "gpt-3.5-turbo" | "gpt-4" | string;

    /* Previous chat history & instructions */
    messages: OpenAIChatMessage[];

    /** What sampling temperature to use. Higher values means the model will take more risks. Try 0.9 for more creative applications, and 0 (argmax sampling) for ones with a well-defined answer. */
    temperature?: number;

    /** An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass. So 0.1 means only the tokens comprising the top 10% probability mass are considered  */
    top_p?: number;

    /** Maximum number of tokens to generate in the completion */
    max_tokens?: number;

    /* Whether the response should be streamed */
    stream?: boolean;

    /* Unique user identifier, used by OpenAI to track down violating requests */
    user?: string;
}

export interface OpenAIChatMessage {
    role: "system" | "assistant" | "user";
    content: string;
}

export type TuringOpenAIPartialResult = TuringOpenAIResult

export interface TuringOpenAIResult {
    result: string;
    done: boolean;
    cost: number;
    finishReason: "length" | "stop" | null;
}