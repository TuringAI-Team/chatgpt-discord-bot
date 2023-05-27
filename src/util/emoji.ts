import { ComponentEmojiResolvable, EmojiIdentifierResolvable } from "discord.js";

type DisplayEmojiType = EmojiIdentifierResolvable | ComponentEmojiResolvable

export interface DisplayEmoji {
    display?: DisplayEmojiType;
    fallback: string;
}

export type DisplayEmojiOnly = Required<Pick<DisplayEmoji, "display">>

export class Emoji {
    public static display(emoji: DisplayEmoji, display: boolean = false): string | DisplayEmojiType {
        return display ? emoji.display ?? emoji.fallback : emoji.fallback;
    }

    public static displayOnly(emoji: DisplayEmojiOnly): string | DisplayEmojiType {
        return emoji.display;
    }
}