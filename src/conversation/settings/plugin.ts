import { DisplayEmoji } from "../../util/emoji.js";

export type ChatSettingsPluginIdentifier = string

export declare interface ChatSettingsPluginOptions {
    /* Display name of the plugin */
    name: string;

    /* ID of the plugin */
    id: ChatSettingsPluginIdentifier;

    /* Emoji for the plugin */
    emoji?: DisplayEmoji | null;

    /* Description of the plugin */
    description: string;
}

export class ChatSettingsPlugin {
    /* Options for the model */
    public readonly options: Required<ChatSettingsPluginOptions>;

    constructor(options: ChatSettingsPluginOptions) {
        this.options = {
            emoji: null, ...options
        };
    }

    public get id(): string {
        return this.options.id;
    }
}

export const ChatSettingsPlugins: ChatSettingsPlugin[] = [
    new ChatSettingsPlugin({
        name: "Google", emoji: { display: "<:google:1102619904185733272>", fallback: "🔎" },
        description: "Searches Google to get up-to-date information from internet.",
        id: "google"
    }),

    new ChatSettingsPlugin({
        name: "Weather", emoji: { fallback: "⛅" },
        description: "View current weather information for a specific location.",
        id: "weather"
    }),

    new ChatSettingsPlugin({
        name: "Wikipedia", emoji: { display: "<:wikipedia:1118608403086966844>", fallback: "🌐" },
        description: "Search on Wikipedia for information on various topics.",
        id: "wikipedia"
    }),

    new ChatSettingsPlugin({
        name: "Tenor", emoji: { display: "<:tenor:1118631079859986452>", fallback: "🎞️" },
        description: "Search for GIFs on Tenor.",
        id: "tenor"
    }),

    new ChatSettingsPlugin({
        name: "FreeToGame", emoji: { display: "<:freetogame:1118612404373311498>", fallback: "🎮" },
        description: "Browse for free games from different platforms or categories.",
        id: "free-games"
    }),

    new ChatSettingsPlugin({
        name: "Tasty", emoji: { fallback: "🍝" },
        description: "Get tasty recipes from tasty.co.",
        id: "tasty"
    }),

    new ChatSettingsPlugin({
        name: "World News", emoji: { fallback: "🌎" },
        description: "Search for current news around the world.",
        id: "world-news"
    }),

    new ChatSettingsPlugin({
        name: "Calculator", emoji: { display: "<:calculator:1118900577653510164>", fallback: "🔢" },
        description: "Calculate something using MathJS.",
        id: "calculator"
    }),

    new ChatSettingsPlugin({
        name: "GitHub", emoji: { display: "<:github:1097828013871222865>", fallback: "🐙" },
        description: "Search for users & projects on GitHub.",
        id: "github"
    }),

    new ChatSettingsPlugin({
        name: "Code Interpreter", emoji: { fallback: "📡" },
        description: "Execute code in a sandbox using WandBox.",
        id: "code-interpreter"
    }),

    new ChatSettingsPlugin({
        name: "Diagrams", emoji: { fallback: "📊" },
        description: "Display beautiful charts & diagrams.",
        id: "mermaid"
    })
]