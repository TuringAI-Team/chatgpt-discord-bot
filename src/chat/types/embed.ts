import { ColorResolvable } from "discord.js";

export interface ChatEmbed {
    /* Title of the embed */
    title?: string;

    /* Description of the embed */
    description?: string;

    /* Image URL of the embed */
    image?: string;

    /* Color of the embed */
    color?: ColorResolvable;

    /* Whether the current time should be shown in the footer */
    time?: boolean;

    /* Text to display in the footer */
    footer?: string;
}