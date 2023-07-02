import { ImageStyle } from "./style.js";

export interface ImagePrompt {
    /** Things to include in the image */
    prompt: string;

    /** Things to *not* include in the image */
    negative?: string;

    /** Additional tags to include; not actually being used */
    tags?: string;

    /** Which filter was used */
    style?: ImageStyle;
}