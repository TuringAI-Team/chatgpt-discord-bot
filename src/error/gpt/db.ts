import { PostgrestError } from "@supabase/supabase-js";
import { GPTError, GPTErrorType } from "./base.js";

import { Database } from "../../db/types/db.js";
import { StorageError } from "@supabase/storage-js";

export interface GPTDatabaseErrorOptions {
    collection: keyof Database["public"]["Tables"];
    raw: PostgrestError | StorageError;
}

export class GPTDatabaseError extends GPTError<GPTDatabaseErrorOptions> {
    constructor(opts: GPTDatabaseErrorOptions) {
        super({
            type: GPTErrorType.Other,
            data: opts
        });
    }

    /**
     * Convert the error into a readable error message.
     * @returns Human-readable error message
     */
    public toString(): string {
        return `Failed to perform database operation on collection '${this.options.data.collection}' with error message: ${this.options.data.raw.message}`;
    }
}