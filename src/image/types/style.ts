export interface ImageStyle {
    /** Name of the style */
    name: string;

    /** Fitting emoji for the style */
    emoji: string;

    /** Identifier of the style */
    id: string;
}

export const ImageStyles: ImageStyle[] = [
    {
        name: "Cinematic", emoji: "🎥",
        id: "cinematic"
    },

    {
        name: "Anime", emoji: "😊",
        id: "anime"
    },

    {
        name: "Comic book", emoji: "✏️",
        id: "comic-book"
    },

    {
        name: "Pixel art", emoji: "🤖",
        id: "pixel-art"
    },

    {
        name: "Photographic", emoji: "📸",
        id: "photographic"
    },

    {
        name: "Digital art", emoji: "🖥️",
        id: "digital-art"
    },

    {
        name: "Line art", emoji: "✏️",
        id: "line-art"
    },

    {
        name: "Analog film", emoji: "🎥",
        id: "analog-film"
    },

    {
        name: "3D model", emoji: "📊",
        id: "3d-model"
    },

    {
        name: "Origami", emoji: "🧻",
        id: "origami"
    },

    {
        name: "Neon punk", emoji: "🌈",
        id: "neon-punk"
    },

    {
        name: "Isometric", emoji: "👀",
        id: "isometric"
    }
]