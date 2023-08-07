import { ComponentEmojiResolvable, EmojiIdentifierResolvable } from "discord.js";

type DisplayEmojiType = EmojiIdentifierResolvable | ComponentEmojiResolvable

export interface DisplayEmoji {
    fallback: string;
    display?: any;
}

export class Emoji {
    public static display<T extends string | DisplayEmojiType = DisplayEmojiType>(emoji: DisplayEmoji, display: boolean = false): T {
        return display ? emoji.display ?? emoji.fallback : emoji.fallback;
    }
}