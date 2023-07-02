import { TuringAPIError, TuringErrorOptions } from "./turing.js";

interface ImageAPIErrorData {
    message: string;
    name: "invalid_prompts";
}

export class ImageAPIError extends TuringAPIError<ImageAPIErrorData> {
    constructor(opts: TuringErrorOptions<ImageAPIErrorData>) {
        super(opts);
    }

    public get filtered(): boolean {
        return this.data !== null && this.data.name === "invalid_prompts";
    }
    
    public toString(): string {
        return `Failed to request image endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}: ${this.data && typeof this.data.message === "string" ? this.data.message : this.data ? JSON.stringify(this.data) : "(none)"}`;
    }
}