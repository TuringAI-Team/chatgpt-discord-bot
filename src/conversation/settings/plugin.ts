import { DisplayEmojiOnly } from "../../util/emoji.js";

export type ChatSettingsPluginIdentifier = string

export declare interface ChatSettingsPluginOptions {
    /* Display name of the plugin */
    name: string;

    /* ID of the plugin */
    id: ChatSettingsPluginIdentifier;

    /* Emoji for the plugin */
    emoji?: DisplayEmojiOnly | null;

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
        name: "Klarna Shopping",
        description: "Search and compare prices from thousands of online shops.",
        emoji: { display: "<:plugin_klarna:1111971683444723723>" },
        id: "klarna"
    }),

    new ChatSettingsPlugin({
        name: "URL Reader",
        description: "Read multiple URLs and their content for chat context.",
        id: "urlReader"
    })
]