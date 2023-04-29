import { GPTAPIError, GPTAPIErrorOptions } from "./api.js";

export enum StableHordeErrorType {
    Blocked, ViolatesTOS, AbusePrevention
}

export class StableHordeAPIError extends GPTAPIError {
    constructor(opts: GPTAPIErrorOptions) {
        super(opts);
    }

    public isBlocked(): boolean {
        return this.hasError() === StableHordeErrorType.Blocked;
    }

    public violatesTermsOfService(): boolean {
        return this.hasError() === StableHordeErrorType.ViolatesTOS;
    }

    public blockedByAbusePrevention(): boolean {
        return this.hasError() === StableHordeErrorType.AbusePrevention;
    }

    private hasError(): StableHordeErrorType | null {
        const message = this.options.data.message;
        if (message === null) return null;

        if (message.includes("unethical images")) return StableHordeErrorType.Blocked;
        else if (message.includes("This prompt appears to violate our terms of service")) return StableHordeErrorType.ViolatesTOS;
        else if (message.includes("Due to abuse prevention")) return StableHordeErrorType.AbusePrevention; 

        return null;
    }
    
    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Failed to request Stable Horde endpoint ${this.options.data.endpoint} with status code ${this.options.data.code}${this.options.data.message !== null ? ": " + this.options.data.message : ""}`;
    }
}