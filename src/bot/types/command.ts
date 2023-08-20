import type { ApplicationCommandOption, ApplicationCommandOptionTypes, ApplicationCommandTypes } from "discordeno";

import type { RestrictionType } from "../utils/restriction.js";
import type { DBEnvironment } from "../../db/types/mod.js";
import type { MessageResponse } from "../utils/response.js";
import type { CustomInteraction } from "./discordeno.js";
import type { DiscordBot } from "../mod.js";

export type CommandOption = Omit<ApplicationCommandOption, "name">
export type CommandOptionWithName = ApplicationCommandOption

export type CommandOptionValue<T extends string | number | boolean = string | number | boolean> = {
    /** Type of the option */
    type: ApplicationCommandOptionTypes;

    /** Value of the option */
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

interface CommandHandlerOptions<T extends Record<string, CommandOption>> {
	bot: DiscordBot;
	interaction: CustomInteraction;
	options: Record<keyof T, CommandOptionValue>;
	env: DBEnvironment;
}

export interface Command<T extends Record<string, CommandOption> = Record<string, CommandOption>> {
    /** Name of the command */
    name: string;

    /** Description of the command */
    description: string;

	/** Restrictions of the command */
	restrictions?: RestrictionType[];

    /** Type of the command */
    type?: ApplicationCommandTypes;

    /** Cool-down of the command */
    cooldown?: CommandCooldown;

    /** Options of the command */
    options?: T;

    /** Handler of the command */
    handler: (
        options: CommandHandlerOptions<T>
    ) => Promise<MessageResponse | void> | MessageResponse | void;
}