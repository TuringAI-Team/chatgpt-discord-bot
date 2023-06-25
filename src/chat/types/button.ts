import { ButtonStyle, ComponentEmojiResolvable } from "discord.js";

export interface ChatButton {
    /* Label of the button */
    label: string;

    /* Emoji of the button */
    emoji?: ComponentEmojiResolvable;

    /* Style of the button */
    style?: ButtonStyle;

    /* URL of the button, if applicable */
    url?: string;

    /* Whether the button should be disabled */
    disabled?: boolean;
    
    /* ID of the button */
    id?: string;
}