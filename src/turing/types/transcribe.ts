export interface TuringTranscribeBody {
    ai: "whisper" | "whisper-fast";
    model: "tiny" | "base" | "small" | "medium";
    url: string;
}

export interface TuringTranscribeSegment {
    text: string;
}

export interface TuringTranscribeRawResult {
    segments: TuringTranscribeSegment[];
}

export interface TuringTranscribeResult {
    text: string;
    segments: TuringTranscribeSegment[];
}