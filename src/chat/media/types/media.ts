export enum ChatMediaType {
    Images = "images", Documents = "documents"
}

export type ChatMedia = {
    /** Type of this attached media */
    id: ChatMediaType;

    /** How much this media cost to process */
    cost?: number;
} & Record<string, any>