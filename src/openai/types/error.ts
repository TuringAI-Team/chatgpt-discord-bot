export type OpenAIErrorType = "server_error" | "requests" | "invalid_request_error" | "access_terminated" | "insufficient_quota";

export interface OpenAIErrorData {
    error: {
        /* Informative error message */
        message: string;

        /* Type of the error */
        type: OpenAIErrorType;
        
        /* TODO: Figure out what these fields do */
        param: null;
        code: null;
    }
}