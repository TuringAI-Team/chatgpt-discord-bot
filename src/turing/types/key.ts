export interface TuringAPIKey {
    id: string;
    name: string;
    createdAt: string;
    lastUsed: string;
    uses: number;
}

export interface TuringAPIKeyData {
    id: string;
    apiToken: string;
    captchaToken: string;
}