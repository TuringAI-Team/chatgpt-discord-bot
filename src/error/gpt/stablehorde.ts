import { GPTAPIError, GPTAPIErrorOptions } from "./api.js";

export class StableHordeAPIError extends GPTAPIError {
    constructor(opts: GPTAPIErrorOptions) {
        super(opts);
    }

    /**
     * Tell whether this error is due to the image generation being blocked, caused by blocked keywords.
     * @returns Whether the generation request was blocked
     */
    public isBlocked(): boolean {
        return this.options.data.message !== null ? this.options.data.message.includes("unethical images") : false;
    }

    public isTooExpensive(): boolean {
        return this.options.data.message !== null ? this.options.data.message.includes("the client needs to already have the required kudos") : false;
    }
    
    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Failed to request Stable Horde endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}${this.options.data.message !== null ? ": " + this.options.data.message : ""}`;
    }
}