export interface TuringAPIKey {
    id: string;
    name: string;
    createdAt: string;
    lastUsed: number;
    uses: number;
}

export interface TuringAPIKeyData {
    name: string;
    id: string;
    apiToken: string;
    captchaToken: string;
    createdAt: string;
    lastUsed: number;
}