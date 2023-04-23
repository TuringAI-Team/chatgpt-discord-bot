import { OpenAIErrorType } from "../../openai/types/error.js";
import { GPTError, GPTErrorType } from "./base.js";

export interface GPTAPIErrorOptions {
    /** Which endpoint was requested */
    endpoint: string;

    /** HTTP status code returned by the API */
    code: number;

    /** Status message returned by the API */
    message: string | null;

    /** Status ID returned by the API */
    id: OpenAIErrorType | null;
}

export class GPTAPIError extends GPTError<GPTAPIErrorOptions> {
    constructor(opts: GPTAPIErrorOptions) {
        super({
            type: GPTErrorType.API,
            data: {
                ...opts,
                message: opts.message ? opts.message.replace(/ *\([^)]*\) */g, "") : null
            }
        });
    }

    /**
     * Tell whether the occurred API error is server-side.
     * @returns Whether the API error occurred on the server-side
     */
    public isServerSide(): boolean {
        return this.options.data.code .toString().startsWith("5")
            || this.options.data.message === "The server is currently overloaded with other requests. Sorry about that! You can retry your request, or contact us through our help center at help.openai.com if the error persists."
            || this.options.data.id === "server_error";
    }

    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Failed to request endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}${this.options.data.id ? ` and identifier ${this.options.data.id}` : ""}${this.options.data.message !== null ? ": " + this.options.data.message : ""}`;
    }
}