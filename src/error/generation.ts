import { GPTError, GPTErrorType } from "./base.js";

export enum GPTGenerationErrorType {
    /* The account is unusable */
    SessionUnusable,

    /* The response was empty */
    Empty,

    /* The prompt was blocked by external moderation filters */
    Moderation,

    /* The prompt was too long */
    Length,

    /* The conversation is already busy */
    Busy,

    /* The conversation is inactive */
    Inactive,

    /* The generation request got cancelled */
    Cancelled,

    /* An other error occurred */
    Other
}

type GPTGenerationErrorOptions<T> = {
    /** Which type of error occurred */
    type: GPTGenerationErrorType;

    /** The exception thrown by the API library */
    cause?: Error;

    /** Any additional data */
    data?: T;
}

export class GPTGenerationError<T = any> extends GPTError<GPTGenerationErrorOptions<T>> {
    constructor(opts: GPTGenerationErrorOptions<T>) {
        super({
            type: GPTErrorType.Generation,
            data: opts
        });
    }

    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Something went wrong with code ${GPTGenerationErrorType[this.options.data.type]}${this.options.data.cause ? ": " + this.options.data.cause.toString() : ""}`;
    }
}