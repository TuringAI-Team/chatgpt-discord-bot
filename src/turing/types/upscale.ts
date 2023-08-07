export type TuringUpscaleModel = "GFPGAN" | "RealESRGAN_x4plus" | "RealESRGAN_x2plus" | "RealESRGAN_x4plus_anime_6B" | "NMKD_Siax" | "4x_AnimeSharp"
export type TuringUpscaleStatus = "done" | "generating" | "queued"

export interface TuringUpscaleBody {
    upscaler: TuringUpscaleModel;
    image: string;
}

export interface TuringUpscaleResultImage {
    url: string;
    base64: string;
}

export interface TuringUpscaleResult {
    result: TuringUpscaleResultImage;
    cost: number;
    status: TuringUpscaleStatus;
    done: boolean;
}