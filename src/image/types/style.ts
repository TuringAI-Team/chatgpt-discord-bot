export interface ImageStyle {
    /** Name of the style */
    name: string;

    /** Fitting emoji for the style */
    emoji: string;

    /** Tags for the style */
    tags: string[];

    /** Identifier of the style */
    id: string;
}

export const ImageStyles: ImageStyle[] = [
    {
        name: "Cinematic", emoji: "🎥",
        tags: [ "cinematic shot", "dramatic lighting", "vignette", "4k rtx" ],
        id: "cinematic"
    },

    {
        name: "Anime", emoji: "😊",
        tags: [ "anime style", "anime", "sharp edges" ],
        id: "anime"
    },

    {
        name: "Comic book", emoji: "✏️",
        tags: [ "comic book" ],
        id: "comic-book"
    },

    {
        name: "Pixel art", emoji: "🤖",
        tags: [ "pixel art", "voxel", "pixel style" ],
        id: "pixel-art"
    },

    {
        name: "Photographic", emoji: "📸",
        tags: [ "photographic", "realism", "realistic", "rtx" ],
        id: "photographic"
    },

    {
        name: "Digital art", emoji: "🖥️",
        tags: [ "digital art", "digital art style" ],
        id: "digital-art"
    },

    {
        name: "Line art", emoji: "✏️",
        tags: [ "line art", "line art style" ],
        id: "line-art"
    },

    {
        name: "Analog film", emoji: "🎥",
        tags: [ "analog film", "grain" ],
        id: "analog-film"
    },

    {
        name: "3D model", emoji: "📊",
        tags: [ "3d model", "game engine render", "unreal engine" ],
        id: "3d-model"
    },

    {
        name: "Origami", emoji: "🧻",
        tags: [ "origami", "origami style", "paper" ],
        id: "origami"
    },

    {
        name: "Neon punk", emoji: "🌈",
        tags: [ "neon punk", "neon style" ],
        id: "neon-punk"
    },

    {
        name: "Isometric", emoji: "👀",
        tags: [ "isometric", "game engine render", "isometric style" ],
        id: "isometric"
    }
]