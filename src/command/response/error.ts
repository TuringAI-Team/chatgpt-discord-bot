import { CacheType, ChatInputCommandInteraction, ColorResolvable, CommandInteraction, DMChannel, InteractionResponse, Message, MessageComponentInteraction, TextChannel, ThreadChannel } from "discord.js";

import { Response } from "../response.js";
import { Command } from "../command.js";

export enum ErrorType {
    Error, Other
}

interface ErrorResponseOptions {
    /* Interaction to reply to */
    interaction: ChatInputCommandInteraction;

    /* Command to reply to */
    command: Command;

    /* Message to display */
    message: string;

    /* Emoji to display */
    emoji?: string | null;

    /* Type of the error */
    type?: ErrorType;

    /* Color of the error embed */
    color?: ColorResolvable;
}

export class ErrorResponse extends Response {
    private readonly options: ErrorResponseOptions;

    constructor(options: ErrorResponseOptions) {
        super();

        this.options = {
            ...options,
            type: options.type ?? ErrorType.Other
        };

        this.addEmbed(builder => builder
            .setTitle(this.options.type === ErrorType.Error ? "Uh-oh..." : null)
            .setDescription(`${options.message}${options.emoji !== null ? ` ${options.emoji ?? "❌"}` : ""}${this.options.type === ErrorType.Error ? "\n*The developers have been notified*." : ""}`) 
            .setColor(options.color ?? "Red")
        );

        this.setEphemeral(true);
    }

    public async send(interaction: MessageComponentInteraction<CacheType> | CommandInteraction<CacheType> | Message<boolean> | TextChannel | DMChannel | ThreadChannel<boolean>): Promise<Message<boolean> | InteractionResponse<boolean> | null> {
        /* Remove the cool-down from the executed command. */
        await this.options.command.removeCooldown(this.options.interaction);
        return this.send(interaction);
    }
}