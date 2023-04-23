export interface StableHordeModel {
    /* Name of the model */
    name: string;

    /* Description of the model */
    description: string;

    /* Summarized description of the model */
    summary: string;

    /* Whether the model is NSFW */
    nsfw: boolean;

    /* URLs of images showcasing the model */
    showcases?: string[];
}

export interface StableHordeConfigModel {
    /* Name of the model */
    name: string;

    /* Display name of the model, as an overwrite */
    displayName?: string;

    /* Description of the model, as an overwrite */
    description?: string;

    /* Summarized description of the model */
    summary: string;

    /* Whether the model should be restricted to Premium users */
    premium?: boolean;

    /* Whether the model counts as NSFW, as an overwrite */
    nsfw?: boolean;

    /* Tags to add to the prompt for the model, if available */
    tags?: string[];
}

export const STABLE_HORDE_AVAILABLE_MODELS: StableHordeConfigModel[] = [
    { name: "stable_diffusion", description: "Generalist image generation model, useful for all things", summary: "Generic model, useful for everything" },
    { name: "Epic Diffusion", description: "General-purpose model focused on high-quality outputs with support for various styles", summary: "High quality outputs, various styles" },
    { name: "Dreamlike Photoreal", description: "Photo-realistic image generation model", summary: "Photo-realistic images" },
    { name: "Dreamshaper", summary: "Good all-in-one model" },
    { name: "Deliberate", nsfw: false, summary: "Ability to create 'anything you want'" },
    { name: "Vivid Watercolors", summary: "Beatiful water-color images" },
    { name: "Midjourney Diffusion", description: "Stable Diffusion fine-tuned on MidJourney images, cartoonish", tags: [ "mdjrny-v4 style" ], summary: "Cartoonish & realistic image generation" },
    { name: "Project Unreal Engine 5", summary: "Images like out of Unreal Engine 5" },
    { name: "Hentai Diffusion", tags: [ "anime", "hentai" ], summary: "Anime/hentai-focused model, consistent style" },
    { name: "Grapefruit Hentai", tags: [ "anime", "hentai" ], summary: "The best hentai/anime model with bright and soft style" },
    { name: "Papercut Diffusion", tags: [ "PaperCut" ], summary: "Paper cut images" },
    { name: "Anything Diffusion", summary: "HQ anime images" },
    { name: "ACertainThing", nsfw: true, summary: "Better than Anything Diffusion, focused on scenes" },
    { name: "Realistic Vision", nsfw: false, summary: "Photorealistic humans" },
    { name: "Redshift Diffusion", tags: [ "redshift style" ], summary: "High-quality 3D artworks" },
    { name: "GTA5 Artwork Diffusion", tags: [ "gtav style" ], summary: "Trained on loading screens of GTA V, can generate GTA V content" },
    { name: "App Icon Diffusion", tags: [ "IconsMi" ], summary: "App icon-like images" },
    { name: "Cheese Daddys Landscape Mix", displayName: "Landscape Mix", summary: "Landscape images" },
    { name: "ChromaV5", tags: [ "ChromaV5", "award winning photography", "extremely detailed", "artstation", "8k", "incredible art" ], summary: "Metallic/chrome images" },
    { name: "Microworlds", description: "Micro-world image generator", tags: [ "microworld render style" ], summary: "Microworld NFT art" },
    { name: "Arcane Diffusion", tags: [ "arcane style" ], summary: "Arcane TV show" },
    // { name: "PortraitPlus", displayName: "Portrait Plus", description: "SD model specialized in close-up portraits", tags: [ "portrait" ], summary: "Close-up portraits of humans, not for scenes or animals" }
]