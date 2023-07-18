import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, Message, User } from "discord.js";
import { randomUUID } from "crypto";
import chalk from "chalk";

import { DatabaseConversation, DatabaseConversationMessage, DatabaseResponseMessage } from "../db/schemas/conversation.js";
import { ChatSettingsModel, ChatSettingsModelBillingType, ChatSettingsModels } from "./settings/model.js";
import { DatabaseUser, UserSubscriptionPlanType, UserSubscriptionType } from "../db/schemas/user.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/generation.js";
import { ChatSettingsTone, ChatSettingsTones } from "./settings/tone.js";
import { ChatInputImage, ImageBuffer } from "../chat/types/image.js";
import { Cooldown, CooldownModifier } from "./utils/cooldown.js";
import { ModerationResult } from "../moderation/moderation.js";
import { UserPlanChatExpense } from "../db/managers/plan.js";
import { ResponseMessage } from "../chat/types/message.js";
import { ChatDocument } from "../chat/types/document.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { ChatClientResult } from "../chat/client.js";
import { ConversationManager } from "./manager.js";
import { ChatModel } from "../chat/types/model.js";
import { GPTAPIError } from "../error/api.js";
import { GeneratorOptions } from "./generator.js";
import { Response } from "../command/response.js";
import { GenerationOptions } from "./manager.js";
import { BotDiscordClient } from "../bot/bot.js";
import { Utils } from "../util/utils.js";

export interface ChatInput {
	/* The input message itself; always given */
	content: string;

	/* Additional text documents attached to the message */
	documents?: ChatDocument[];

	/* Additional input images */
	images?: ChatInputImage[];
}

export interface ChatInteraction {
	/* ID of the chat interaction */
	id: string;

	/* Input message */
	input: ChatInput;

	/* Generated output */
	output: ResponseMessage;

	/* Moderation results, for the output */
	moderation: ModerationResult | null;

	/* Discord message, which triggered the generation */
	trigger: Message;

	/* Reply to the trigger on Discord */
	reply: Message | null;

	/* Time the interaction was triggered */
	time: number;
}

export type ChatGeneratedInteraction = ChatInteraction & {
	/* How many tries it took to generate the response */
	tries: number;
}

export interface ChatChargeOptions {
	model: ChatSettingsModel;
	tone: ChatSettingsTone;

	interaction: ChatInteraction;
	db: DatabaseInfo;
}

/* How many tries to allow to retry after an error occurred duration generation */
const ConversationMaximumTries: number = 3

/* Usual cool-down for interactions in the conversation */
export const ConversationCooldownModifier: Record<UserSubscriptionPlanType, CooldownModifier> = {
	free: {
		multiplier: 1
	},

	voter: {
		time: 75 * 1000
	},

	subscription: {
		time: 15 * 1000
	},

	plan: {
		multiplier: 0
	}
}

export const ConversationDefaultCooldown: Required<Pick<CooldownModifier, "time">> = {
	time: 120 * 1000
}

export const ConversationTTL: number = 30 * 60 * 1000

export declare interface Conversation {
	on(event: "done", listener: () => void): this;
	once(event: "done", listener: () => void): this;
}

export class ConversationHistory {
	private readonly conversation: Conversation;

	/* History of prompts & responses */
	public entries: ChatInteraction[];

	constructor(conversation: Conversation) {
		this.conversation = conversation;
		this.entries = [];
	}

	/**
	 * Try to initialize an existing conversation, using data from the database.
	 */
	public async load(db: DatabaseConversation): Promise<void> {
		/* If the saved conversation has any message history, try to load it. */
		if (db.history && db.history !== null && Array.isArray(db.history)) {
			await this.push(db.history.map(entry => ({
				input: entry.input, id: entry.id,

				/* This is awful, but it works... */
				output: this.databaseToResponseMessage(entry.output),

				reply: null,
				time: Date.now(),
				trigger: null!,
				moderation: null
			})));
		}
	}

	public remove(entry: ChatInteraction): void {
		const index: number = this.entries.findIndex(e => e.id === entry.id);
		if (isNaN(index)) return;

		this.entries.splice(index, 1);
	}

	public find(message: Message): ChatInteraction | null {
		return this.entries.find(e => e.trigger && e.trigger.id === message.id) ?? null
	}

	public get(amount: number): ChatInteraction[] {
		return this.entries.slice(-amount);
	}

	public shift(): void {
		this.entries.shift();
	}

	public reset(): void {
		this.entries = [];
	}

	public set(entries: ChatInteraction[]): void {
		this.entries = entries;
	}

	public async push(entry?: ChatInteraction | ChatInteraction[]): Promise<void> {
		/* Add the entry to this cluster first. */
		if (entry) {
			if (Array.isArray(entry)) this.set(entry);
			else this.entries.push(entry);
		}

		/* Then, broadcast the change to all other clusters. */
		await this.conversation.manager.bot.db.eval(((client: BotDiscordClient, context: { id: string; history: ChatInteraction[]; cluster: number }) => {
			if (client.bot.data.id !== context.cluster) {
				const c: Conversation | null = client.bot.conversation.get(context.id);

				if (c !== null) {
					c.history.set(context.history);
					c.bump();
				}
			}
		}) as any, {
			context: {
				id: this.conversation.id,
				history: this.entries.map(e => ({ ...e, trigger: null, reply: null })),
				cluster: this.conversation.manager.bot.data.id
			},

			timeout: 5 * 1000
		}).catch(() => {});
	}

	public get previous(): ChatInteraction | null {
		if (this.entries.length === 0) return null;
		return this.entries[this.entries.length - 1];
	}

	public get length(): number {
		return this.entries.length;
	}

	public toDatabase(): DatabaseConversationMessage[] {
		return this.entries.map(entry => ({
			id: entry.id, input: entry.input,
			output: this.responseMessageToDatabase(entry)
		}));
	}

    public responseMessageToDatabase({ output: message }: ChatInteraction): DatabaseResponseMessage {
        return {
            ...message,

            images: message.images ? message.images.map(i => ({
				...i, data: i.data.toString()
			})) : undefined
        };
    }

    public databaseToResponseMessage(message: DatabaseResponseMessage): ResponseMessage {
        return {
            ...message,
			
            images: message.images ? message.images.map(i => ({
				...i, data: ImageBuffer.load(i.data)
			})) : undefined
        };
    }
}

export class Conversation {
	/* Manager in charge of controlling this conversation */
	public readonly manager: ConversationManager;

	/* Discord user, which created the conversation */
	public readonly user: User;

	/* Whether the conversation is active & ready */
	public active: boolean;

	/* Whether the client is locked, because it is initializing or shutting down */
	public generating: boolean;

	/* History manager of this conversation */
	public history: ConversationHistory;

	/* Last interaction in this conversation */
	public updated: number;

	/* Cool-down manager */
	public cooldown: Cooldown;

	/* How long this conversation stays cached in memory */
	public timer: NodeJS.Timeout | null;

	/* The conversation's database entry */
	public db: DatabaseConversation | null;

	constructor(manager: ConversationManager, user: User) {
		this.manager = manager;

		this.cooldown = new Cooldown({
			conversation: this
		});

		this.timer = null;
		this.db = null;

		this.user = user;

		/* Set up the conversation data. */
		this.history = new ConversationHistory(this);

		/* Set up some default values. */
		this.updated = Date.now();
		this.generating = false;
		this.active = false;
	}

	/**
	 * Cached database conversation
	 */
	public async cached(): Promise<DatabaseConversation | null> {
		const db = await this.manager.bot.db.fetchFromCacheOrDatabase<string, DatabaseConversation>(
			"conversations", this.id
		);

		this.db = db;
		return db;
	}

	/**
	 * Try to initialize an existing conversation, using data from the database.
	 */
	public async load(): Promise<void> {
		if (this.active) return;
		
		const db: DatabaseConversation | null = await this.cached();
		if (db !== null) await this.history.load(db);
		
		await this.init();
	}

	public setting<T extends ChatSettingsModel | ChatSettingsTone>(type: "model" | "tone", arr: T[], db: DatabaseUser | DatabaseInfo): T {
		/* The database user instance */
		const user: DatabaseUser =
			(db as DatabaseInfo).user
				? (db as DatabaseInfo).user
				: db as DatabaseUser;

		/* Model identifier */
		const id: string = this.manager.bot.db.settings.get(user, `chat:${type}`);
		const model: T | null = arr.find(m => m.id === id) ?? null;

		return model ?? arr[0];
	}

	public model(db: DatabaseUser | DatabaseInfo): ChatSettingsModel {
		return this.setting<ChatSettingsModel>("model", ChatSettingsModels, db);
	}

	public tone(db: DatabaseUser | DatabaseInfo): ChatSettingsTone {
		return this.setting<ChatSettingsTone>("tone", ChatSettingsTones, db);
	}

	/**
	 * Initialize the conversation.
	 */
	public async init(): Promise<void> {
        /* Update the conversation entry in the database. */
        if (this.history.length === 0) await this.manager.bot.db.users.updateConversation(this, {
			created: new Date().toISOString(), id: this.id,
			active: true, history: null
		});

		this.bump();
		this.active = true;
	}

	private resetTime(): number {
		const timeToReset: number = this.updated + ConversationTTL;
		return Math.max(timeToReset - Date.now(), 0); 
	}

	/**
	 * Apply the reset timer, to reset the conversation after inactivity.
	 */
	public bump(): void {
		this.updated = Date.now();

		if (this.timer === null) {
			this.timer = setTimeout(async () => {
				this.manager.delete(this);
			}, this.resetTime());
		} else this.timer = this.timer.refresh();
	}

	/**
	 * Reset the conversation, and clear its history.
	 */
	public async reset(db: DatabaseUser, remove: boolean = true): Promise<void> {
		/* Currently configured chat model */
		const settingsModel: ChatSettingsModel = this.model(db);
		const settingsTone: ChatSettingsTone = this.tone(db);

		const model: ChatModel = this.manager.client.modelForSetting(settingsModel);

		/* Before resetting the conversation, call the chat model's reset callback. */
		await model.reset({
			conversation: this, model: settingsModel, tone: settingsTone
		});

		this.history.reset();
		this.bump();

		/* Remove the entry in the database. */
        if (remove) await this.manager.bot.db.client
            .from(this.manager.bot.db.collectionName("conversations"))
			.delete()

			.eq("id", this.id);
			
		else await this.manager.bot.db.users.updateConversation(this, { history: [] });

		/* Unlock the conversation, if a requestion was running meanwhile. */
		this.active = !remove;
		this.generating = false;
	}

	/**
	 * Generate a response using the selected model for the given prompt.
	 * @param options Generation options
	 * 
	 * @returns Given chat response
	 */
	public async generate(options: GeneratorOptions & GenerationOptions): Promise<ChatGeneratedInteraction> {
		if (!this.active) throw new GPTGenerationError({ type: GPTGenerationErrorType.Inactive });
		if (this.generating) throw new GPTGenerationError({ type: GPTGenerationErrorType.Busy });

		this.generating = true;
		this.bump();

		/* Amount of attempted tries */
		let tries: number = 0;

		/* When the generation request was started */
		const before: Date = new Date();

		/* Chat model response */
		let data: ChatClientResult | null = null;

		do {
			try {
				data = await this.manager.generate(options);

			} catch (error) {
				this.bump();
				tries++;

				/* If all of the retries were exhausted, throw the error. */
				if (tries === ConversationMaximumTries) {
					throw error;
					
				} else {
					if (this.manager.bot.dev) this.manager.bot.logger.warn(`Request by ${chalk.bold(options.conversation.user.username)} failed, retrying [ ${chalk.bold(tries)}/${chalk.bold(ConversationMaximumTries)} ] ->`, error);

					const db = await this.manager.bot.error.handle({
						error, title: `Error while processing a message [**${tries}**/**${ConversationMaximumTries}**]`, raw: true
					});

					/* Display a notice message to the user on Discord. */
					await this.manager.progress.notice(options, {
						text: `Something went wrong while processing your message [\`${db.id}\`]`
					});
				}

				/* If the request failed, due to the current session running out of credit or the account being terminated, throw an error. */
				if (
					(error instanceof GPTAPIError && (error.options.data.id === "insufficient_quota" || error.options.data.id == "access_terminated"))
					|| (error instanceof GPTGenerationError && error.options.data.type === GPTGenerationErrorType.SessionUnusable)
				) {
					throw new GPTGenerationError({ type: GPTGenerationErrorType.SessionUnusable });

				} else

				/* The request got rate-limited, or failed for some reason */
				if ((error instanceof GPTAPIError && (error.options.data.id === "requests" || error.options.data.id === "invalid_request_error")) || error instanceof TypeError) {
					/* Try again, with increasing retry delay. */
					await new Promise(resolve => setTimeout(resolve, ((tries * 5) + 5) * 1000));

				} else

				/* Throw through any type of generation error, as they should be handled instantly. */
				if ((error instanceof GPTGenerationError && error.options.data.cause && !(error.options.data.cause instanceof GPTAPIError)) || (error instanceof GPTAPIError && !error.isServerSide())) {
					throw error;

				} else if (error instanceof GPTGenerationError && (error.options.data.type === GPTGenerationErrorType.Empty || error.options.data.type === GPTGenerationErrorType.Length)) {
					throw error;
				}

			} finally {
				this.generating = false;
			}
		} while (tries < ConversationMaximumTries && data === null);

		this.generating = false;
		this.bump();

		if (data === null) throw new Error("What.");

		const moderation: ModerationResult = await this.manager.bot.moderation.check({
			user: this.user, db: options.db,

			content: data.output.text,
			source: "chatBot"
		});

        /* Random message identifier */
        const id: string = randomUUID();

		const result: ChatInteraction = {
			input: data.input, output: data.output,
			trigger: options.trigger, reply: null,
			moderation, id, time: Date.now()
		};

		/* Tone & model stuff */
		const model = this.model(options.db);
		const tone = this.tone(options.db);

		await this.history.push(result);

		await this.manager.bot.db.metrics.changeChatMetric({
			models: { [model.id]: "+1" },
			tones: { [tone.id]: "+1" }
		});

		if (result.output.raw && result.output.raw.usage) await this.manager.bot.db.metrics.changeChatMetric({
			tokens: {
				prompt: { [model.id]: `+${result.output.raw.usage.prompt}` },
				completion: { [model.id]: `+${result.output.raw.usage.completion}` }
			}
		});

		await this.manager.bot.db.users.updateConversation(this, {
			/* Save a stripped-down version of the chat history in the database. */
			history: this.history.entries.map(entry => ({
				id: entry.id, input: entry.input, output: this.history.responseMessageToDatabase(entry)
			}))
		});

		/* If the user has a running pay-as-you plan, charge them for the usage. */
		await this.charge({
			model, tone, interaction: result, db: options.db
		});

		/* If messages should be collected in the database, insert the generated message. */
		if (!this.manager.bot.dev) await this.manager.bot.db.users.updateInteraction({
			completedAt: new Date().toISOString(), requestedAt: before.toISOString(),
			id: result.id, input: result.input, output: this.history.responseMessageToDatabase(result),
			model: model.id, tone: tone.id
		});

		const cooldown: number | null = await this.cooldownTime(options.db, this.model(options.db));
		if (cooldown !== null) this.cooldown.use(cooldown);

		return {
			...result, tries
		};
	}

	public async cooldownTime(db: DatabaseInfo, model: ChatSettingsModel): Promise<number | null> {
		/* Subscription type of the user */
		const type: UserSubscriptionType = await this.manager.bot.db.users.type(db);
		if (type.type === "plan" && type.location === "user") return null;

		if (type.type === "plan" && type.location === "guild") {
			/* Cool-down, set by the server */
			const guildCooldown: number = this.manager.bot.db.settings.get<number>(db.guild!, "limits:cooldown");
			return guildCooldown * 1000;
		}
		
		/* Cool-down duration & modifier */
		const baseModifier: number = ConversationCooldownModifier[type.type].multiplier && !model.premiumOnly
			? ConversationCooldownModifier[type.type].multiplier! : 1;

		/* Cool-down modifier, set by the model */
		const modelModifier: number = model.options.cooldown && model.options.cooldown.multiplier
			? model.options.cooldown.multiplier
			: 1;

		const baseDuration: number = model.options.cooldown && model.options.cooldown.time && model.premiumOnly
			? model.options.cooldown.time
			: ConversationCooldownModifier[type.type].time ?? ConversationDefaultCooldown.time;

		const finalDuration: number = baseDuration * baseModifier * modelModifier;
		return Math.round(finalDuration);
	}

	public async cooldownResponse(db: DatabaseInfo): Promise<Response> {
		/* Subscription type of the user */
		const subscriptionType = await this.manager.bot.db.users.type(db);

		const response: Response = new Response();
		const additional: EmbedBuilder[] = [];
		
		if (!subscriptionType.premium) {
			additional.push(
				new EmbedBuilder()
					.setDescription(`✨ **[Premium](${Utils.shopURL()})** greatly **decreases** the cool-down & includes further benefits, view \`/premium\` for more.`)
					.setColor("Orange")
			);
			
		} else if (subscriptionType.premium && subscriptionType.location === "guild") {
			if (subscriptionType.type === "subscription") {
				additional.push(
					new EmbedBuilder()
						.setDescription(`✨ Buying **[Premium](${Utils.shopURL()})** for **yourself** greatly *decreases* the cool-down & also includes further benefits, view \`/premium\` for more.`)
						.setColor("Orange")
				);

			} else if (subscriptionType.type === "plan") {
				/* Cool-down, set by the server */
				const guildCooldown: number = this.manager.bot.db.settings.get<number>(db.guild!, "limits:cooldown");

				additional.push(
					new EmbedBuilder()
						.setDescription(`📊 The server owners have configured a cool-down of **${guildCooldown} seconds** using the **Pay-as-you-go** plan.\n${db.user.subscription !== null || db.user.plan !== null ? `*You can configure the **priority** of Premium in \`/settings\`*.` : ""}`)
						.setColor("Orange")
				);
			}
		}

		/* Choose an ad to display, if applicable. */
		const ad = await this.manager.bot.db.campaign.ad({ db });

		if (ad !== null) {
			response.addComponent(ActionRowBuilder<ButtonBuilder>, ad.response.row);
			additional.push(ad.response.embed);
		}

		this.manager.bot.db.metrics.changeCooldownMetric({
			chat: "+1"
		});

		response.addEmbeds([
			new EmbedBuilder()
				.setTitle("Whoa-whoa... slow down ⌛")
				.setDescription(`I can't keep up with your requests; you can talk to me again <t:${Math.floor((this.cooldown.state.startedAt! + this.cooldown.state.expiresIn! + 1000) / 1000)}:R>.`)
				.setColor("Yellow"),

			...additional
		]);

		return response.setEphemeral(true);
	}

	public async charge(options: ChatChargeOptions): Promise<UserPlanChatExpense | null> {
		/* Subscription type of the user */
		const type: UserSubscriptionType = await this.manager.bot.db.users.type(options.db);
		if (type.type !== "plan") return null;

		const db = options.db[type.location];
		if (!db || db.plan === null || !this.manager.bot.db.plan.active(db)) return null;

		/* Calculated credit amount */
		const amount: number | null = this.calculateChargeAmount(options);
		if (amount === null) return null;

		/* Add the charge to the user's plan. */
		const charge = await this.manager.bot.db.plan.expenseForChat(options.db, {
			used: amount, bonus: options.model.options.billing.extra ?? 0.20,
			
			data: {
				model: options.model.id,

				duration: options.interaction.output.raw && options.interaction.output.raw.duration
					? options.interaction.output.raw.duration : undefined,

				tokens: options.interaction.output.raw && options.interaction.output.raw.usage
					? options.interaction.output.raw.usage : undefined
			}
		});

		return charge;
	}

	private chargeBillingForType({ model }: ChatChargeOptions, type: "prompt" | "completion" | "all"): number {
		if (typeof model.options.billing.amount === "object") {
			if (type !== "all") return model.options.billing.amount[type];
			else return model.options.billing.amount["prompt"] + model.options.billing.amount["completion"];
		} else return model.options.billing.amount;
	};

	/**
	 * Calculate the amount of credit to charge for this chat request.
	 */
	public calculateChargeAmount(options: ChatChargeOptions): number | null {
		const { interaction, model } = options;
		let cost: number = 0;

		/* Per 1000 tokens */
		if (model.options.billing.type === ChatSettingsModelBillingType.Per1000Tokens) {
			if (!interaction.output.raw!.usage) return null;

			const promptCost: number = (interaction.output.raw!.usage.prompt / 1000) * this.chargeBillingForType(options, "prompt");
			const completionCost: number = (interaction.output.raw!.usage.completion / 1000) * this.chargeBillingForType(options, "completion");

			cost += promptCost + completionCost;

		} else if (model.options.billing.type === ChatSettingsModelBillingType.PerMessage) {
			cost += this.chargeBillingForType(options, "all");

		} else if (model.options.billing.type === ChatSettingsModelBillingType.PerSecond) {
			if (!interaction.output.raw?.duration) return null;
			cost += (interaction.output.raw.duration / 1000) * this.chargeBillingForType(options, "all");

		} else if (model.options.billing.type === ChatSettingsModelBillingType.Custom) {
			if (!interaction.output.raw?.cost) return null;
			cost += interaction.output.raw?.cost;
		}

		/* Count all analyzed images too. */
		if (model.options.billing.type !== ChatSettingsModelBillingType.Custom && options.interaction.input.images && options.interaction.input.images.length > 0) {
			options.interaction.input.images.forEach(image => {
				cost += (image.duration / 1000) * 0.0004;
			});
		}

		return cost > 0 ? cost : null;
	}

	public get previous(): ChatInteraction | null {
		return this.history.previous;
	}

	public get id(): string {
		return this.user.id;
	}
}