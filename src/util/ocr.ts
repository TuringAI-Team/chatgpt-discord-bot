import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";

type ImageOCREngine = 1 | 2 | 3

interface ImageOCROptions {
    /* Image URL to analyze */
    url: string;

    /* Which OCR engine to use */
    engine?: ImageOCREngine;
}

interface ImageOCRRawResult {
    ParsedText: string;
    TextOverlay: ImageOCRRawOverlay;
}

interface ImageOCRRawResponse {
    ParsedResults?: ImageOCRRawResult[];
    IsErroredOnProcessing: boolean;
    ErrorMessage?: string[];
    OCRExitCode: number;
}

interface ImageOCRRawOverlay {
    Lines: ImageOCRRawLine[];
    HasOverlay: boolean;
}

interface ImageOCRRawLine {
    LineText: string;
    Words: ImageOCRRawWord[];
    MaxHeight: number;
    MinTop: number;
}

interface ImageOCRLine {
    text: string;
    words: ImageOCRWord[];
    maxHeight: number;
    minTop: number;
}

interface ImageOCRRawWord {
    WordText: string;
    Left: number;
    Top: number;
    Width: number;
    Height: number;
}

interface ImageOCRWord {
    text: string;
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface ImageOCRResult {
    /* Detected text in the image */
    content: string;

    /* Detected lines in the image */
    lines: ImageOCRLine[];
}

/**
 * Try to detect all text visible in the given image
 * 
 * @param bot Bot instance
 * @param options Image detection options
 * 
 * @returns Image detection results
 */
export const detectText = async (bot: Bot, options: ImageOCROptions): Promise<ImageOCRResult | null> => {  
    /* Make the API request. */
    const response = await fetch(`https://api.ocr.space/parse/ImageUrl?url=${options.url}&OCREngine=${options.engine ?? 1}&scale=true`, {
        method: "GET",

        headers: {
            apikey: bot.app.config.ocr.key
        }
    });

    /* Get the raw JSON response data. */
    const body: ImageOCRRawResponse = await response.json();

    if (body.ErrorMessage && body.ErrorMessage.length > 0) {
        throw new GPTAPIError({
            code: response.status, endpoint: "/parse/image",
            id: null, message: body.ErrorMessage[0]
        });

    } else if (response.status !== 200) {
        throw new GPTAPIError({
            code: response.status, endpoint: "/parse/image",
            id: null, message: null
        });
    }

    if (!body.ParsedResults || body.ParsedResults.length === 0 || body.ParsedResults[0].ParsedText.trim().length === 0) return null;

    /* All detected lines of text in the image. */
    const lines: ImageOCRLine[] = body.ParsedResults[0].TextOverlay.Lines.map(l => ({
        text: l.LineText,

        words: l.Words.map(w => ({
            text: w.WordText,
            left: w.Left,
            top: w.Top,
            width: w.Width,
            height: w.Height
        })),
        
        maxHeight: l.MaxHeight,
        minTop: l.MinTop
    }));

    /* The entire detected text in the image */
    const text: string = body.ParsedResults[0].ParsedText.replaceAll("\r\n", "\n").trim();

    return {
        content: text, lines
    };
}