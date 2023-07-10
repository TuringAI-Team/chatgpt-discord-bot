import { Image, createCanvas } from "@napi-rs/canvas";
import { readFile } from "fs/promises";

import { StorageImage } from "../../db/managers/storage.js";
import { ImageBuffer } from "../../chat/types/image.js";
import { DatabaseImage } from "../types/image.js";
import { Utils } from "../../util/utils.js";
import { Bot } from "../../bot/bot.js";

type AssetName = "censored" | "warning"

/* All special images */
const Assets: Record<AssetName, Buffer> = {
    /* This will be loaded when the app starts ... */
} as any

const loadAssets = async (): Promise<void> => {
    const paths: string[] = await Utils.search("./assets/imagine", "png");

    for (const path of paths) {
        const name: AssetName = Utils.baseName(Utils.fileName(path)) as AssetName;

        const buffer: Buffer = await readFile(path);
        Assets[name] = buffer;
    }
}

/* Load all assets from the directory. */
loadAssets();

/**
 * Render the specified image generation results into a single image, to display in a Discord embed.
 * 
 * @param options Image generation options, used to determine width & height
 * @param result Image results
 * 
 * @returns A buffer, containing the final merged PNG image
 */
export const renderIntoSingleImage = async (bot: Bot, db: DatabaseImage): Promise<Buffer> => {
    /* Fetch all the images. */
    const images: Buffer[] = await Promise.all(db.results.map(async image => {
        if (image.status === "filtered") return Assets.censored;
        else if (image.status === "failed") return Assets.warning;

        const storage: StorageImage = bot.image.url(db, image);
        const data: ImageBuffer = (await Utils.fetchBuffer(storage.url))!;

        return data.buffer;
    }));

    /* If there's only a single image, simply return that one instead of creating a canvas to only render one. */
    if (images.length === 1) return images[0];

    /* How many images to display per row, maximum */
    const perRow: number = images.length > 4 ? 4 : 2;
    const rows: number = Math.ceil(images.length / perRow);

    /* Width & height of the canvas */
    const width: number = db.options.width * perRow;
    const height: number = rows * db.options.height;

    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");

    images.forEach((result, index) => {
        const x: number = (index % perRow) * db.options.width;
        const y: number = Math.floor(index / perRow) * db.options.height;

        const image: Image = new Image();
        image.src = result;

        context.drawImage(image, x, y, db.options.width, db.options.height);
    });

    return await canvas.encode("png")
}