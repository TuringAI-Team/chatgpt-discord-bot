import { ContextMenuCommandBuilder, SlashCommandBuilder, SlashCommandSubcommandsOnlyBuilder } from "@discordjs/builders";
import { AutocompleteInteraction, ChatInputCommandInteraction, ContextMenuCommandInteraction } from "discord.js";
import { APIApplicationCommandOptionChoice } from "discord-api-types/v10";

import { DatabaseInfo, UserSubscriptionPlanType } from "../db/managers/user.js";
import { UserRole } from "../db/managers/role.js";
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

export type CommandRestrictionType = (UserRole | UserSubscriptionPlanType)[]

export interface CommandSpecificCooldown {
	free: number;
	voter: number;
	subscription: number;
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

	/* Which roles the command should be restricted to */
	restriction?: CommandRestrictionType;
}

export class Command<U extends ContextMenuCommandInteraction | ChatInputCommandInteraction = ChatInputCommandInteraction> {
    protected readonly bot: Bot;

	/* Data of the command */
	public readonly builder: CommandBuilder;

    /* Other command options */
    public readonly options: Required<CommandOptions>;

	constructor(bot: Bot, builder: CommandBuilder, options?: CommandOptions, defaultOptions: CommandOptions = { long: false, cooldown: null, restriction: [], waitForStart: false } as any) {
		this.bot = bot;
		this.builder = builder;

        this.options = {
			...defaultOptions,
			...options ?? {}
		} as Required<CommandOptions>;
	}

	public restricted(check: CommandRestrictionType | (UserRole | UserSubscriptionPlanType)): boolean {
		return (typeof check !== "object" ? [ check ] : check)
			.some(c => this.options.restriction.includes(c));
	}

	public premiumOnly(): boolean {
		return this.restricted([ "subscription", "plan" ]);
	}

	public planOnly(): boolean {
		return this.restricted("plan");
	}

	public subscriptionOnly(): boolean {
		return this.restricted("subscription");
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