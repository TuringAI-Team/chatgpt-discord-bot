export type TuringVisionModel = "blip2" | "ocr"

export interface TuringVisionBody {
    model: TuringVisionModel[];
    image: string;
}

export interface TuringVisionResult {
    description: string;
    lines: ImageOCRLine[] | null;
    text: string | null;
    cost: number;
    done: boolean;
}

export interface ImageOCRLine {
    text: string;
    words: ImageOCRWord[];
    maxHeight: number;
    minTop: number;
}

export interface ImageOCRWord {
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ImageOCRResult {
    content: string;
    lines: ImageOCRLine[];
}