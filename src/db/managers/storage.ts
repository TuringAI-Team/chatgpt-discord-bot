import { Bucket, StorageClient, StorageError } from "@supabase/storage-js";

import { ImageGenerationResult, StableHordeGenerationResult } from "../../image/types/image.js";
import { DatabaseDescription } from "../../image/description.js";
import { GPTDatabaseError } from "../../error/gpt/db.js";
import { ImageBuffer } from "../../chat/types/image.js";
import { ClusterDatabaseManager } from "../cluster.js";
import { SubClusterDatabaseManager } from "../sub.js";

type StorageBucketName = "images" | "descriptions"

export interface StorageImage {
    /* URL to the image file */
    url: string;
}

export class StorageManager extends SubClusterDatabaseManager {
    /* The Supabase storage client */
    private client: StorageClient;

    constructor(db: ClusterDatabaseManager) {
        super(db);
        this.client = null!;
    }

    public async setup(): Promise<void> { 
        /* Set up the Supabase storage client. */
        this.client = new StorageClient(`${this.db.bot.app.config.db.supabase.url}/storage/v1`, {
            Authorization: `Bearer ${this.db.bot.app.config.db.supabase.key.service}`,
            apikey: this.db.bot.app.config.db.supabase.key.anon
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
        this.error(error);

        if (data === null) throw new Error(`Bucket ${name} doesn't exist`);
        return data;
    }

    /**
     * Fetch a Stable Horde generation image from the database.
     * @param image Image to fetch
     * 
     * @returns URL to the public image
     */
    public async fetchImage(image: ImageGenerationResult | string, bucket: StorageBucketName): Promise<StorageImage> {
        const { data } = this.client
            .from("images")
            .getPublicUrl(typeof image === "object" ? `${image.id}.png` : image);

        return { url: data.publicUrl };
    }

    public async uploadImageGenerationResult(image: ImageGenerationResult, data: Buffer): Promise<StorageImage> {
        const { error } = await this.client
            .from("images")
            .upload(`${image.id}.png`, data, {
                cacheControl: "86400",
                contentType: "image/png"
            });

        /* Check for any errors. */
        this.error(error);
        return this.fetchImage(image, "images");
    }

    public async uploadImageDescription(image: DatabaseDescription, data: ImageBuffer): Promise<void> {
        const name: string = image.id;

        const { error } = await this.client
            .from("descriptions")
            .upload(name, data.buffer, {
                cacheControl: "86400",
                contentType: "image/png"
            });

        /* Check for any errors. */
        this.error(error);
    }

    public async uploadImages(result: StableHordeGenerationResult): Promise<StorageImage[]> {
        /* All generated images */
        const images: ImageGenerationResult[] = result.images.filter(i => !i.censored);

        /* Upload all of the images to the storage bucket. */
        await Promise.all(images.map(async image => {
            const data: Buffer = Buffer.from(await (await fetch(image.url)).arrayBuffer());
            return this.uploadImageGenerationResult(image, data);
        }));

        /* Fetch all of the uploaded images again. */
        return Promise.all(images.map(image => this.fetchImage(image, "images")));
    }

    /**
     * Check whether an error occurred while making a request, and throw an error if applicable.
     * @param error Storage error that possibly occurred
     * 
     * @throws A GPTDatabaseError, if needed
     */
    private error(error: StorageError | null): void {
        if (error !== null) throw new GPTDatabaseError({
            collection: "images",
            raw: error
        });
    }
}