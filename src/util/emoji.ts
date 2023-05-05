import { APIMessageComponentEmoji, ComponentEmojiResolvable, EmojiIdentifierResolvable, GuildEmoji, ReactionEmoji } from "discord.js";

export interface DisplayEmoji {
    display?: EmojiIdentifierResolvable | ComponentEmojiResolvable;
    fallback: string;
}

export class Emoji {
    public static display(emoji: DisplayEmoji, display: boolean = false): string | GuildEmoji | ReactionEmoji | APIMessageComponentEmoji {
        return display ? emoji.display ?? emoji.fallback : emoji.fallback;
    }
}