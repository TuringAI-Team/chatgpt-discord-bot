import { GPTAPIError } from "../error/gpt/api.js";
import { Bot } from "../bot/bot.js";

type ImageOCREngine = 1 | 2 | 3 | 5

interface ImageOCROptions {
    /* Image URL to analyze */
    url: string;

    /* Which OCR engine to use */
    engine?: ImageOCREngine;
}

interface ImageOCRRawResult {
    ParsedText: string;
}

interface ImageOCRRawResponse {
    ParsedResults?: ImageOCRRawResult[];
}

export interface ImageOCRResult {
    /* Detected text in the image, `null` if none was detected */
    content: string | null;
}

/**
 * Try to detect all text visible in the given image
 * 
 * @param bot Bot instance
 * @param options Image detection options
 * 
 * @returns Image detection results
 */
export const detectText = async (bot: Bot, options: ImageOCROptions): Promise<ImageOCRResult> => {  
    /* Make the API request. */
    const response = await fetch(`https://api.ocr.space/parse/ImageUrl?url=${options.url}&OCREngine=${options.engine ?? 1}&scale=true`, {
        method: "GET",

        headers: {
            apikey: bot.app.config.ocr.key
        }
    });

    if (response.status !== 200) throw new GPTAPIError({
        code: response.status, endpoint: "/parse/image",
        id: null, message: null
    });

    /* Get the JSON response data. */
    const body: ImageOCRRawResponse = await response.json();
    if (!body.ParsedResults || body.ParsedResults.length === 0) throw new Error("No detected text");

    return {
        content: body.ParsedResults[0].ParsedText.length > 0 ? body.ParsedResults[0].ParsedText : null
    };
}