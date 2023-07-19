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