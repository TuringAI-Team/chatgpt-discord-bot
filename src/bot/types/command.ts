import type { ApplicationCommandOption, ApplicationCommandOptionTypes, ApplicationCommandTypes } from "discordeno";

import type { MessageResponse } from "../utils/response.js";
import type { DiscordBot } from "../index.js";

import { CustomInteraction } from "./discordeno.js";

export type CommandOption = Omit<ApplicationCommandOption, "name">
export type CommandOptionWithName = ApplicationCommandOption

export type CommandOptionValue<T extends string | number | boolean = string | number | boolean> = {
    /** Type of the option */
    type: ApplicationCommandOptionTypes;

    /** Value of option */
    value: T;
}

export type CommandOptionValueWithName<T extends string | number | boolean = string | number | boolean> =
    CommandOptionValue<T> & {
        /** Name of the option */
        name: string;
    }

export interface CommandCooldown {
    time: number;
}

export interface Command<T extends Record<string, CommandOption> = Record<string, CommandOption>> {
    /** Name of the command */
    name: string;

    /** Description of the command */
    description: string;

    /** Type of the command */
    type?: ApplicationCommandTypes;

    /** Cool-down of the command */
    cooldown?: CommandCooldown;

    /** Options of the command */
    options?: T;

    /** Handler of the command */
    handler: (
        bot: DiscordBot, interaction: CustomInteraction, options: Record<keyof T, CommandOptionValue>
    ) => Promise<MessageResponse | void> | MessageResponse | void;
}