/* POST https://api.openai.com/v1/moderations */
export interface OpenAIModerationsBody {
    input: string;
}

export interface OpenAIModerationsCategories {
    hate: boolean;
    "hate/threatening": boolean;
    "self-harm": boolean;
    sexual: boolean;
    "sexual/minors": boolean;
    violence: boolean;
    "violence/graphic": boolean;
}

export interface OpenAIModerationsCategoryScores {
    hate: number;
    "hate/threatening": number;
    "self-harm": number;
    sexual: number;
    "sexual/minors": number;
    violence: number;
    "violence/graphic": number;
}

export interface OpenAIModerationsData {
    id: string,
    model: string,

    results: [
        {
            categories: OpenAIModerationsCategories
            category_scores: OpenAIModerationsCategoryScores

            flagged: boolean
        }
    ]
}