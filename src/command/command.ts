import { ContextMenuCommandBuilder, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import { AutocompleteInteraction, ChatInputCommandInteraction, ContextMenuCommandInteraction } from "discord.js";
import { APIApplicationCommandOptionChoice } from "discord-api-types/v10";

import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "./response.js";
import { Bot } from "../bot/bot.js";

export type CommandBuilder = 
	SlashCommandBuilder
	| Omit<SlashCommandBuilder, "addSubcommand" | "addSubcommandGroup">
	| SlashCommandSubcommandsOnlyBuilder
	| ContextMenuCommandBuilder

export type CommandInteraction = ChatInputCommandInteraction
export type CommandOptionChoice<T = string | number> = APIApplicationCommandOptionChoice<T>

export type CommandResponse = Promise<Response | undefined>

export enum CommandPrivateType {
	/* The command can only be used by Premium subscribers; both guild & user Premium */
	PremiumOnly = "premium",

	/* The command can only be used by moderators & the owner; it is restricted to the development server */
	ModeratorOnly = "mod",

	/* The command can only be used by the owner; it is restricted to the development server */
	OwnerOnly = "owner"
}

export interface CommandSpecificCooldown {
	Free: number;
	Voter: number;
	GuildPremium: number;
	UserPremium: number;
}

export type CommandCooldown = number | CommandSpecificCooldown

export interface CommandOptions {
    /* Whether the command may take longer than 3 seconds (the default limit) to execute */
    long?: boolean;

	/* How long the cool-down between executions of the command should be */
	cooldown?: CommandCooldown | null;

	/* Whether the command works when someone is banned from the bot */
	always?: boolean;

	/* Whether the command requires the bot to be fully started */
	waitForStart?: boolean;

	/* Whether the command should be restricted to the development server */
	private?: CommandPrivateType;
}

export class Command<U extends ContextMenuCommandInteraction | ChatInputCommandInteraction = ChatInputCommandInteraction, T extends CommandOptions = CommandOptions> {
    protected readonly bot: Bot;

	/* Data of the command */
	public readonly builder: CommandBuilder;

    /* Other command options */
    public readonly options: T;

	constructor(bot: Bot, builder: CommandBuilder, options?: T, defaultOptions: T = { long: false, cooldown: null, private: undefined, waitForStart: false } as any) {
		this.bot = bot;
		this.builder = builder;

        this.options = {
			...defaultOptions,
			...options ?? {}
		};
	}

	/**
	 * Reset the cool-down for this command.
	 */
	public async removeCooldown(interaction: ChatInputCommandInteraction): Promise<void> {
		return this.bot.command.removeCooldown(interaction, this as any);
	}


	/**
	 * Respond to auto-completion requests.
	 */
	public async complete(interaction: AutocompleteInteraction, db: DatabaseInfo): Promise<CommandOptionChoice[]> {
		return [];
	}

	/**
	 * Execute the command.
	 */
	public async run(interaction: U, db: DatabaseInfo): CommandResponse {
		return undefined;
	}
}