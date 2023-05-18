import { YoutubeTranscript } from "youtube-transcript";
import search, { VideoSearchResult } from "yt-search";

interface YouTubeSearchOptions {
    /* Which query to search for */
    query: string;

    /* Maximum amount of search results */ 
    max?: number;
}

export type YouTubeVideo = VideoSearchResult

interface YoutubeSubtitlesOptions {
    /* Which YouTube URL/ID to get the subtitles for */
    url: string;

    /* In which language to return the subtitles */
    language?: string;
}

export interface YouTubeSubtitle {
    start: number;
    duration: number;

    content: string;
}

export class YouTube {
    /**
     * Search for a YouTube video using a query, and maximum amount of items to return.
     * @param options Options about fetching the search results  
     * 
     * @returns The actual search results
     */
    public static async search(options: YouTubeSearchOptions): Promise<YouTubeVideo[]> {
        /* Search for the query on YouTube. */
        const results = await search({
            query: options.query
        });

        return results.videos.slice(undefined, options.max ?? undefined);
    }

    public static async subtitles(options: YoutubeSubtitlesOptions): Promise<YouTubeSubtitle[]> {
        /* Fetch the subtitles for the YouTube video. */
        const results = await YoutubeTranscript.fetchTranscript(options.url, {
            lang: options.language ?? "en"
        });

        return results.map(subtitle => ({
            content: subtitle.text,

            duration: subtitle.duration,
            start: subtitle.offset
        }));
    }
}