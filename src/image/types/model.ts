export interface StableHordeConfigModel {
    /* Internal name of the model */
    id: string;

    /* Display name of the model, as an overwrite */
    name?: string;

    /* Description of the model, as an overwrite */
    description: string;

    /* Whether the model should be restricted to Premium users */
    premium?: boolean;

    /* Whether the model counts as NSFW, as an overwrite */
    nsfw: boolean;

    /* Tags to add to the prompt for the model, if available */
    tags?: string[];
}

export type StableHordeModel = Omit<Required<StableHordeConfigModel>, "name"> & {
    name: string | null;
}

export const StableHordeConfigModels: StableHordeConfigModel[] = [
    { id: "stable_diffusion", name: "Stable Diffusion", description: "Generic model, useful for everything", nsfw: false },
    { id: "Epic Diffusion", description: "High quality outputs, various styles", nsfw: false },
    { id: "Dreamlike Photoreal", description: "Photo-realistic images", nsfw: false },
    { id: "Dreamlike Diffusion", description: "Stable Diffusion 1.5 fine-tuned on high quality art, made by dreamlike.art", tags: [ "dreamlikeart" ], nsfw: false },
    { id: "Dreamshaper", description: "Good all-in-one model", nsfw: false },
    { id: "Deliberate", nsfw: false, description: "Ability to create 'anything you want'" },
    { id: "Vivid Watercolors", description: "Beatiful water-color images", nsfw: false },
    { id: "Midjourney Diffusion", description: "Stable Diffusion fine-tuned on MidJourney images, cartoonish", tags: [ "mdjrny-v4 style" ], nsfw: false },
    { id: "Project Unreal Engine 5", description: "Images like out of Unreal Engine 5", nsfw: false },
    { id: "Hentai Diffusion", tags: [ "anime", "hentai" ], description: "Anime/hentai-focused model, consistent style", nsfw: true },
    { id: "Grapefruit Hentai", tags: [ "anime", "hentai" ], description: "The best hentai/anime model with bright and soft style", nsfw: true },
    { id: "Papercut Diffusion", tags: [ "PaperCut" ], description: "Paper cut images", nsfw: false },
    { id: "Anything Diffusion", description: "HQ anime images", nsfw: true },
    { id: "Robo-Diffusion", name: "Robo Diffusion", tags: [ "nousr robot" ], description: "Specialized in generating beautiful images of robots", nsfw: false },
    { id: "ACertainThing", nsfw: true, description: "Better than Anything Diffusion, focused on scenes" },
    { id: "Realistic Vision", nsfw: false, description: "Photorealistic humans" },
    { id: "Redshift Diffusion", tags: [ "redshift style" ], description: "High-quality 3D artworks", nsfw: false },
    { id: "GTA5 Artwork Diffusion", tags: [ "gtav style" ], description: "Trained on loading screens of GTA V, can generate GTA V content", nsfw: false },
    { id: "App Icon Diffusion", tags: [ "IconsMi" ], description: "App icon-like images", nsfw: false },
    { id: "Cheese Daddys Landscape Mix", name: "Landscape Mix", description: "Landscape images", nsfw: false },
    { id: "ChromaV5", tags: [ "ChromaV5", "award winning photography", "extremely detailed", "artstation", "8k", "incredible art" ], description: "Metallic/chrome images", nsfw: false },
    { id: "Microworlds", description: "Micro-world image generator", tags: [ "microworld render style" ], nsfw: false },
    { id: "Arcane Diffusion", tags: [ "arcane style" ], description: "Arcane TV show", nsfw: false }
]