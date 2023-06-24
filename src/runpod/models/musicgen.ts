import { type ImageBuffer } from "../../chat/types/image.js";
import { type RunPodResult } from "../api.js";

export interface RunPodMusicGenInput {
    descriptions: string[];
}

export interface RunPodMusicGenOutput {
    output: string[];
}

export interface RunPodMusicGenResult {
    raw: RunPodResult<RunPodMusicGenOutput>;
    results: ImageBuffer[];
}