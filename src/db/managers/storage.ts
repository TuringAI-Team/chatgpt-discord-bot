import { Bucket, StorageClient, StorageError } from "@supabase/storage-js";

import { ImageGenerationResult, StableHordeGenerationResult } from "../../image/types/image.js";
import { GPTDatabaseError } from "../../error/gpt/db.js";
import { DatabaseManager } from "../manager.js";

type StorageBucketName = "images"

export interface StorageImage {
    /* URL to the image file */
    url: string;
}

export class StorageManager {
    /* The database manager itself */
    private readonly db: DatabaseManager;

    /* The Supabase storage client */
    private client: StorageClient;

    constructor(db: DatabaseManager) {
        this.db = db;
        this.client = null!;
    }

    public async setup(): Promise<void> { 
        /* Set up the Supabase storage client. */
        this.client = new StorageClient(`${this.db.bot.app.config.db.supabase.url}/storage/v1`, {
            apikey: this.db.bot.app.config.db.supabase.key.anon,
            Authorization: `Bearer ${this.db.bot.app.config.db.supabase.key.service}`
        });
    }

    /**
     * Get information about a bucket.
     * @param name Which bucket
     * 
     * @returns Bucket data
     */
    public async bucket(name: StorageBucketName): Promise<Bucket> {
        const { data, error } = await this.client.getBucket(name);
        this.checkError(error);

        if (data === null) throw new Error(`Bucket ${name} doesn't exist`);
        return data;
    }

    /**
     * Fetch a Stable Horde generation image from the database.
     * @param image Image to fetch
     * 
     * @returns URL to the public image
     */
    public async fetchImage(image: ImageGenerationResult): Promise<StorageImage> {
        const { data } = this.client
            .from("images")
            .getPublicUrl(`${image.id}.png`);

        return { url: data.publicUrl };
    }

    public async uploadImage(image: ImageGenerationResult, data: Buffer): Promise<StorageImage> {
        const { error } = await this.client
            .from("images")
            .upload(`${image.id}.png`, data, {
                cacheControl: "86400",
                contentType: "image/png"
            });

        /* Check for any errors. */
        this.checkError(error);
        return this.fetchImage(image);
    }

    public async uploadImages(result: StableHordeGenerationResult): Promise<StorageImage[]> {
        /* All generated images */
        const images: ImageGenerationResult[] = result.images;

        /* Upload all of the images to the storage bucket. */
        await Promise.all(images.map(async image => {
            const data: Buffer = Buffer.from(await (await fetch(image.url)).arrayBuffer());
            return this.uploadImage(image, data);
        }));

        /* Fetch all of the uploaded images again. */
        return Promise.all(images.map(image => this.fetchImage(image)));
    }

    /**
     * Check whether an error occured while making a request, and throw an error if applicable.
     * @param error Storage error that possibly occured
     * 
     * @throws A GPTDatabaseError, if needed
     */
    private checkError(error: StorageError | null): void {
        if (error !== null) throw new GPTDatabaseError({
            collection: "images",
            raw: error
        });
    }
}