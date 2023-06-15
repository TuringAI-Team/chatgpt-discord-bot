import { Canvas, Image } from "@napi-rs/canvas";
import mergeImages from "merge-images";
import { readFile } from "fs/promises";

import { StableHordeGenerationResult, ImageGenerationOptions } from "../types/image.js";
import { StorageImage } from "../../db/managers/storage.js";
import { ImageBuffer } from "../../chat/types/image.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

type SpecialImageName = "censored"

/* All special images */
const SpecialImages: Record<SpecialImageName, Buffer> = {
    /* This will be loaded when the app starts ... */
} as any

const loadSpecialImages = async (): Promise<void> => {
    /* Paths of all images */
    const paths: string[] = await Utils.search("./assets/imagine", "png");

    for (const path of paths) {
        /* Get the name of the asset. */
        const name: SpecialImageName = Utils.baseName(Utils.fileName(path)) as SpecialImageName;

        const buffer: Buffer = await readFile(path);
        SpecialImages[name] = buffer;
    }
}

/* Load all special assets from the directory. */
loadSpecialImages();

/**
 * Render the specified image generation results into a single image, to display in a Discord embed.
 * 
 * @param options Image generation options, used to determine width & height
 * @param result Image results
 * 
 * @returns A buffer, containing the final merged PNG image
 */
export const renderIntoSingleImage = async (bot: Bot, options: ImageGenerationOptions, result: StableHordeGenerationResult): Promise<Buffer> => {
    /* Fetch all the images. */
    const images: Buffer[] = await Promise.all(result.images.map(async image => {
        if (image.censored) return SpecialImages.censored;

        const storage: StorageImage = await bot.image.getImageData(image);
        const data: ImageBuffer = (await Utils.fetchBuffer(storage.url))!;

        return data.buffer;
    }));

    /* If there's only a single image, simply return that one instead of creating a canvas to only render one. */
    if (images.length === 1) return images[0];

    /* How many images to display per row, maximum */
    const perRow: number = images.length > 4 ? 4 : 2;
    const rows: number = Math.ceil(images.length / perRow);

    /* Width & height of the canvas */
    const width: number = options.params.width * perRow;
    const height: number = rows * options.params.height;

    /* Merge all of the images together. */
    const data = await mergeImages(images.map((img, index) => {
        const x: number = (index % perRow) * options.params.width;
        const y: number = Math.floor(index / perRow) * options.params.height;

        return {
            src: img,
            x, y
        };
    }), {
        Canvas: Canvas, Image: Image,
        width, height
    } as any);

    return Buffer.from(data.replaceAll("data:image/png;base64,", ""), "base64");
}