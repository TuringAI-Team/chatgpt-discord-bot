import { ColorResolvable } from "discord.js";

export interface ChatEmbed {
    /* Title of the embed */
    title?: string;

    /* Description of the embed */
    description?: string;

    /* Color of the embed */
    color?: ColorResolvable;

    /* Whether the current time should be shown in the footer */
    time?: boolean;
}