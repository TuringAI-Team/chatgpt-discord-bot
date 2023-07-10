export interface ImagePrompt {
    /** Things to include in the image */
    prompt: string;

    /** Things to *not* include in the image */
    negative?: string;

    /** Which filter was used */
    style?: string;

    /* Mode used for the prompt */
    mode?: string;

    /* Original prompt, if an enhancer was used */
    original?: string;
}

export interface ImagePromptEnhancer {
    /** Name of this enhancer */
    name: string;

    /** Emoji of this enhancer */
    emoji: string;

    /** ID of this enhancer */
    id: string;
}

export const ImagePromptEnhancers: ImagePromptEnhancer[] = [
    {
        name: "Don't do anything", emoji: "⛔", id: "none"
    },

    {
        name: "Improve my prompt", emoji: "✨", id: "improve"
    },

    {
        name: "Create a better prompt based on the topic of mine", emoji: "✍️", id: "rewrite"
    }
]