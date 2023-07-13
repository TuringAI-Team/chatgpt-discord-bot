import { RawTranslationData } from "../util/translate.js";
import { GPTError, GPTErrorType } from "./base.js";

export enum GPTTranslationErrorType {
    /** The input message is too long */
    TooLong,

    /** The message could not be translated */
    Failed,

    /** The message doesn't have to be translated/same content */
    SameContent
}

type GPTTranslationErrorOptions = {
    /** Which type of error occurred */
    type: GPTTranslationErrorType;

    /** Raw response data by the AI */
    data?: RawTranslationData;
}

export class GPTTranslationError<T = any> extends GPTError<GPTTranslationErrorOptions> {
    constructor(opts: GPTTranslationErrorOptions) {
        super({
            type: GPTErrorType.Translation,
            data: opts
        });
    }

    public get error(): string | null {
        return this.options.data.data && this.options.data.data.error ? this.options.data.data.error : null;
    }

    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Something went wrong while translating with code ${GPTTranslationErrorType[this.options.data.type]}${this.error ? ": " + this.error : ""}`;
    }
}