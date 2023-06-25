import { type ImageBuffer } from "../../chat/types/image.js";
import { type RunPodResult } from "../api.js";

export type RunPodMusicGenModelName = "large" | "medium"

export interface RunPodMusicGenInput {
    descriptions: string[];
    duration: number;
    modelName: RunPodMusicGenModelName;
}

export interface RunPodMusicGenOutput {
    output: string[];
}

export interface RunPodMusicGenResult {
    raw: RunPodResult<RunPodMusicGenOutput>;
    results: ImageBuffer[];
}