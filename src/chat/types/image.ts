export type ChatImageType = "png" | "jpg" | "jpeg" | "webp"

export class ImageBuffer {
    private data: Buffer;

    constructor(data: Buffer) {
        this.data = data;
    }

    public static from(buffer: ArrayBuffer): ImageBuffer {
        return new ImageBuffer(Buffer.from(buffer));
    }

    /**
     * Create a new image buffer from the specified Base64 string.
     * @param data Base64 string to convert into a buffer
     * @returns 
     */
    public static load(data: string): ImageBuffer {
        return new ImageBuffer( Buffer.from(data, "base64"));
    }

    /**
     * Convert the image buffer into a Base64 string.
     * @returns Base64-encoded image data
     */
    public toString(): string {
        return this.data.toString("base64");
    }

    public get buffer(): Buffer {
        return this.data;
    }
}

export interface ChatBaseImage {
    /* Name of the image */
    name: string;

    /* Type of image */
    type: ChatImageType;

    /* Buffer data of the image */
    data: ImageBuffer;

    /* URL to the image */
    url: string;
}

export type ChatInputImage = Pick<ChatBaseImage, "name" | "type"> & {
    /* Readable text about this image, given to the model */
    description: string;

    /* Text recognized in the image, `null` if none was detected */
    text: string | null;
}

export type ChatAnalyzedImage = Pick<ChatInputImage, "description" | "text">

export interface ChatOutputImage {
    /* Final rendered image */
    data: ImageBuffer;

    /* Optional; prompt used to generate the image */
    prompt?: string;

    /* Optional; an additional note in the footer of the embed */
    notice?: string;

    /* Optional; how long the image took to render/generate */
    duration?: number;
}