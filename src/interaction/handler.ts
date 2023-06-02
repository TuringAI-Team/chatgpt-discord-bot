import { AnySelectMenuInteraction, ButtonInteraction, ModalSubmitInteraction } from "discord.js";

import { DatabaseInfo, UserSubscriptionPlanType } from "../db/managers/user.js";
import { CommandCooldown, CommandOptions, CommandRestrictionType } from "../command/command.js";
import { CooldownData } from "../command/types/cooldown.js";
import { Response } from "../command/response.js";
import { UserRole } from "../db/managers/role.js";
import { Bot } from "../bot/bot.js";

export type InteractionHandlerClassType = ButtonInteraction | AnySelectMenuInteraction | ModalSubmitInteraction
export type InteractionHandlerResponse = Promise<Response | undefined | void>

export type InteractionHandlerOptions = Pick<CommandOptions, "always" | "cooldown" | "restriction" | "synchronous" | "waitForStart">

export enum InteractionType {
	Button, StringSelectMenu, Modal
}

interface InteractionHandlerData {
	name: string;
	description: string;
	type: InteractionType[];
}

export type AnyInteractionHandlerValues = Record<string, string | number | boolean | null>

type InteractionHandlerAllowedTypes = `${"number" | "string" | "boolean" | "any"}${"?" | ""}`
type InteractionHandlerTemplate<T = { [key: string]: any }> = Record<keyof T, InteractionHandlerAllowedTypes>

export interface InteractionHandlerRunOptions<T extends InteractionHandlerClassType = InteractionHandlerClassType, U = AnyInteractionHandlerValues> {
	interaction: T;
	db: DatabaseInfo;
	raw: string[];
	data: U;
}

export class InteractionHandlerBuilder {
	/* Data about this interaction handler */
	public data: Required<InteractionHandlerData>;

	constructor() {
		this.data = {} as any;
	}

	public setName(name: string): InteractionHandlerBuilder {
		this.data.name = name;
		return this;
	}

	public setDescription(description: string): InteractionHandlerBuilder {
		this.data.description = description;
		return this;
	}

	public setType(type: InteractionType[] | InteractionType): InteractionHandlerBuilder {
		this.data.type = typeof type === "object" ? type : [ type ];
		return this;
	}
}

interface InteractionValidationErrorData {
	handler: InteractionHandler;
	key: string;
	error: string;
}

export class InteractionValidationError extends Error {
	constructor({ handler, key, error }: InteractionValidationErrorData) {
		super(`Validation error for key '${key}' in handler '${handler.builder.data.name}': ${error}`);
	}
}

export abstract class InteractionHandler<T extends InteractionHandlerClassType = InteractionHandlerClassType, U = AnyInteractionHandlerValues> {
    protected readonly bot: Bot;

	public readonly builder: InteractionHandlerBuilder;
    public readonly options: Required<InteractionHandlerOptions>;

	/* Template for all values; also to do validation on all values */
	public readonly template: InteractionHandlerTemplate<U> | null;

	constructor(bot: Bot, builder: InteractionHandlerBuilder, template?: InteractionHandlerTemplate<U>, options?: InteractionHandlerOptions, defaultOptions: InteractionHandlerOptions = { cooldown: null, restriction: [], waitForStart: false }) {
		this.bot = bot;

		this.builder = builder;
		this.template = template ?? null;

        this.options = {
			...defaultOptions,
			...options ?? {}
		} as Required<InteractionHandlerOptions>;
	}


	public restricted(check: CommandRestrictionType | (UserRole | UserSubscriptionPlanType)): boolean {
		return (typeof check !== "object" ? [ check ] : check)
			.every(c => this.options.restriction.includes(c));
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


	public async removeCooldown(interaction: T): Promise<void> {
		return this.bot.command.removeCooldown(interaction, this as any);
	}

	public async applyCooldown(interaction: T, db: DatabaseInfo, time?: number): Promise<void> {
		return this.bot.command.applyCooldown(interaction, db, this as any, time);
	}

	public async currentCooldown(interaction: T): Promise<CooldownData | null> {
		return this.bot.command.cooldown(interaction, this as any);
	}


	/**
	 * Execute the interaction handler.
	 */
	public abstract run(data: InteractionHandlerRunOptions<T, U>): InteractionHandlerResponse;
}