import { GPTError, GPTErrorType } from "./base.js";
import { GPTAPIErrorOptions } from "./api.js";

export interface TuringErrorBody<T = any> {
    success: boolean;
    error: TuringErrorData<T>;
}

export type TuringErrorData<T> = T

export type TuringErrorOptions<T> = Pick<GPTAPIErrorOptions, "endpoint" | "code"> & {
    body: TuringErrorBody<T> | null;
}

export class TuringAPIError<T = any> extends GPTError<TuringErrorOptions<T>> {
    constructor(opts: TuringErrorOptions<T>) {
        super({
            data: opts, type: GPTErrorType.API
        });
    }

    public get data(): TuringErrorData<T> | null {
        return this.options.data.body ? this.options.data.body.error : null;
    }
    
    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Failed to request API endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}${typeof this.data !== "object" ? `: ${this.data}` : ""}`;
    }
}