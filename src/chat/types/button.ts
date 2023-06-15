import { ButtonStyle, ComponentEmojiResolvable } from "discord.js";

export interface ChatButton {
    /* Label of the button */
    label: string;

    /* Emoji of the button */
    emoji?: ComponentEmojiResolvable;

    /* Style of the button */
    style?: ButtonStyle;

    /* Whether the button should be disabled */
    disabled?: boolean;
    
    /* ID of the button */
    id?: string;
}