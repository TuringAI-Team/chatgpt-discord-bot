export interface StableHordeGenerationFilter {
    /* Name of the filter */
    name: string;

    /* Fitting emoji for the filter */
    emoji: string;

    /* The tags to add to the prompt for the filter */
    tags: string[];
}

export const STABLE_HORDE_FILTERS: StableHordeGenerationFilter[] = [
    {
        name: "Realistic", emoji: "🌆",
        tags: [ "((realistic))", "((RTX))", "highres", "extreme detail", "((photograph))", "((photorealistic))" ]
    },

    {
        name: "Anime", emoji: "😊",
        tags: [ "((anime))", "((anime style))", "sharp edges" ]
    },

    {
        name: "Pastel", emoji: "✏️",
        tags: [ "((drawing))", "((pastel style))", "((pastel colors))" ]
    },

    {
        name: "Pixel art", emoji: "🤖",
        tags: [ "((pixel art))", "((voxel))", "pixel art", "pixel style" ]
    },

    {
        name: "Watercolor", emoji: "🌊",
        tags: [ "((drawing))", "((watercolor style))", "((watercolor))" ]
    }
]