import { EmbedBuilder, Message, User } from "discord.js";
import chalk from "chalk";

import { DatabaseConversation, DatabaseInfo, DatabaseResponseMessage, DatabaseUser, RawDatabaseConversation, UserSubscriptionType } from "../db/managers/user.js";
import { ChatSettingsModel, ChatSettingsModelBillingType, ChatSettingsModels } from "./settings/model.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ChatSettingsTone, ChatSettingsTones } from "./settings/tone.js";
import { MessageType, ResponseMessage } from "../chat/types/message.js";
import { ChatInputImage, ImageBuffer } from "../chat/types/image.js";
import { UserSubscriptionPlanType } from "../db/managers/user.js";
import { Cooldown, CooldownModifier } from "./utils/cooldown.js";
import { ModerationResult } from "../moderation/moderation.js";
import { UserPlanChatExpense } from "../db/managers/plan.js";
import { ChatDocument } from "../chat/types/document.js";
import { ChatClientResult } from "../chat/client.js";
import { ConversationManager } from "./manager.js";
import { ChatModel } from "../chat/types/model.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { GeneratorOptions } from "./generator.js";
import { Response } from "../command/response.js";
import { GenerationOptions } from "./session.js";
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
const CONVERSATION_ERROR_RETRY_MAX_TRIES: number = 5

/* Usual cool-down for interactions in the conversation */
export const CONVERSATION_COOLDOWN_MODIFIER: Record<UserSubscriptionPlanType, CooldownModifier> = {
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

export const CONVERSATION_DEFAULT_COOLDOWN: Required<Pick<CooldownModifier, "time">> = {
	time: 90 * 1000
}

export declare interface Conversation {
	on(event: "done", listener: () => void): this;
	once(event: "done", listener: () => void): this;
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

	/* History of prompts & responses */
	public history: ChatInteraction[];

	/* Last interaction with this conversation */
	public updatedAt: number | null;

	/* Cool-down manager */
	public cooldown: Cooldown;

	/* How long this conversation stays cached in memory */
	public ttl: number;
	private timer: NodeJS.Timeout | null;

	/* The conversation's database entry */
	public db: DatabaseConversation | null;

	constructor(manager: ConversationManager, user: User) {
		this.manager = manager;

		this.cooldown = new Cooldown({ time: CONVERSATION_DEFAULT_COOLDOWN.time! });

		this.ttl = 30 * 60 * 1000;
		this.timer = null;
		this.db = null;

		this.user = user;

		/* Set up the conversation data. */
		this.history = [];

		/* Set up some default values. */
		this.generating = false;
		this.updatedAt = null;
		this.active = false;
	}

	/**
	 * Cached database user instance
	 */
	public async databaseUser(): Promise<DatabaseUser> {
		return this.manager.bot.db.users.fetchUser(this.user);
	}

	/**
	 * Cached database conversation
	 */
	public async cached(): Promise<DatabaseConversation | null> {
		const db = await this.manager.bot.db.users.fetchFromCacheOrDatabase<string, DatabaseConversation, RawDatabaseConversation>(
			"conversations", this.id,
			raw => this.manager.bot.db.users.rawToConversation(raw)
		);

		this.db = db;
		return db;
	}

	/**
	 * Try to initialize an existing conversation, using data from the database.
	 */
	private async loadFromDatabase(data: DatabaseConversation): Promise<void> {
		/* If the saved conversation has any message history, try to load it. */
		if (data.history && data.history !== null && (data.history as any).forEach) {
			for (const entry of data.history) {
				this.history.push({
					input: entry.input,

					/* This is awful, but it works... */
					output: this.databaseToResponseMessage(entry.output),

					reply: null,
					time: Date.now(),
					trigger: null!,
					moderation: null
				});
			}

			await this.pushToHistory();
		}
	}

	public async loadIfNotActive(): Promise<void> {
		if (this.active) return;
		
		/* Cached database conversation */
		const cached: DatabaseConversation | null = await this.cached();
		if (cached === null) return;
		
		await this.loadFromDatabase(cached);
		await this.init();
	}

	public async changeSetting<T extends ChatSettingsModel | ChatSettingsTone>(type: "model" | "tone", db: DatabaseUser, updated: T): Promise<void> {
		/* Reset the conversation first, as the models might get confused otherwise. */
		await this.reset(db);

		await this.manager.bot.db.settings.apply(db, {
			[`chat:${type}`]: updated.id
		});
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
	 * This also gets called after each "reset", in order to maintain the creation time & future data.
	 */
	public async init(): Promise<void> {
		/* Make sure that the user exists in the database. */
		await this.manager.bot.db.users.fetchUser(this.user);

        /* Update the conversation entry in the database. */
        if (this.history.length === 0) await this.manager.bot.db.users.updateConversation(this, {
                created: Date.now(),id: this.id,
                active: true, history: null
            });

		this.applyResetTimer();
		this.active = true;
	}

	/* Get the timestamp, for when the conversation resets due to inactivity. */
	private getResetTime(relative: boolean = false): number {
		/* Time, when the conversation should reset */
		const timeToReset: number = (this.updatedAt ?? Date.now()) + this.ttl;
		return Math.max(relative ? timeToReset - Date.now() : timeToReset, 0); 
	}

	/**
	 * Apply the reset timer, to reset the conversation after inactivity.
	 * @param updatedAt Time when the last interaction with this conversation occurred, optional
	 */
	private applyResetTimer(): void {
		/* If a timer already exists, reset it. */
		if (this.timer !== null) { clearTimeout(this.timer); this.timer = null; }
		this.updatedAt = Date.now();

		this.timer = setTimeout(async () => {
			this.timer = null;
			this.manager.delete(this);
		}, this.getResetTime(true));
	}

	/**
	 * Reset the conversation, and clear its history.
	 */
	public async reset(db: DatabaseUser, remove: boolean = true): Promise<void> {
		/* Currently configured chat model */
		const settingsModel: ChatSettingsModel = this.model(db);
		const settingsTone: ChatSettingsTone = this.tone(db);

		const model: ChatModel = this.manager.session.client.modelForSetting(settingsModel);

		/* Before resetting the conversation, call the chat model's reset callback. */
		await model.reset({
			conversation: this, model: settingsModel, tone: settingsTone
		});

		/* Reset the conversation data. */
		this.applyResetTimer();
		this.history = [];

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
	 * Call the OpenAI GPT-3 API and generate a response for the given prompt.
	 * @param options Generation options
	 * 
	 * @returns Given chat response
	 */
	public async generate(options: GeneratorOptions & GenerationOptions): Promise<ChatGeneratedInteraction> {
		if (!this.active) throw new Error("Conversation is inactive");
		if (this.generating) throw new GPTGenerationError({ type: GPTGenerationErrorType.Busy });

		/* Lock the conversation during generation. */
		this.generating = true;
		if (this.timer !== null) clearTimeout(this.timer);

		/* Amount of attempted tries */
		let tries: number = 0;

		/* When the generation request was started */
		const before: Date = new Date();

		/* GPT-3 response */
		let data: ChatClientResult | null = null;

		/**
		 * This loop tries to generate a chat response N times, until a response gets generated or the retries are exhausted.
		 */
		do {
			/* Try to generate the response using the chat model. */
			try {
				data = await this.manager.session.generate(options);

			} catch (error) {
				tries++;

				/* If all of the retries were exhausted, throw the error. */
				if (tries === CONVERSATION_ERROR_RETRY_MAX_TRIES) {
					this.generating = false;

					if (error instanceof GPTGenerationError || error instanceof GPTAPIError) {
						throw error;
					} else {
						throw new GPTGenerationError({
							type: GPTGenerationErrorType.Other,
							cause: error as Error
						});
					}
				} else {
					this.manager.bot.logger.warn(`Request by ${chalk.bold(options.conversation.user.username)} failed, retrying [ ${chalk.bold(tries)}/${chalk.bold(CONVERSATION_ERROR_RETRY_MAX_TRIES)} ] ->`, error);

					/* Display a notice message to the user on Discord. */
					options.onProgress({
						id: "", raw: null, type: MessageType.Notice,
						text: `Something went wrong while processing your message, retrying [ **${tries}**/**${CONVERSATION_ERROR_RETRY_MAX_TRIES}** ]`
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
					this.generating = false;
					throw error;

				} else

				if (error instanceof GPTGenerationError && (error.options.data.type === GPTGenerationErrorType.Empty || error.options.data.type === GPTGenerationErrorType.Length)) {
					this.generating = false;
					throw error;

				}
			}
		} while (tries < CONVERSATION_ERROR_RETRY_MAX_TRIES && data === null);

		/* Unlock the conversation after generation has finished. */
		this.generating = false;

		/* Update the reset timer. */
		this.applyResetTimer();

		/* If the data still turned out `null` somehow, ...! */
		if (data === null) throw new Error("What.");

		/* Check the generated message using the moderation endpoint, again. */
		const moderation: ModerationResult = await this.manager.bot.moderation.check({
			user: this.user, db: options.db,

			content: data.output.text,
			source: "chatUser"
		});

		const result: ChatInteraction = {
			input: data.input,
			output: data.output,

			trigger: options.trigger,
			reply: null,

			moderation,
			time: Date.now()
		};

		/* Tone & model stuff */
		const model = this.model(options.db);
		const tone = this.tone(options.db);

		/* Add the response to the history. */
		await this.pushToHistory(result);

		await this.manager.bot.db.metrics.changeChatMetric({
			models: {
				[model.id]: "+1"
			},

			tones: {
				[tone.id]: "+1"
			}
		});

		if (result.output.raw && result.output.raw.usage) await this.manager.bot.db.metrics.changeChatMetric({
			tokens: {
				prompt: {
					[model.id]: `+${result.output.raw.usage.prompt}`
				},

				completion: {
					[model.id]: `+${result.output.raw.usage.completion}`
				}
			}
		});

		/* Also update the last-updated time and message count in the database for this conversation. */
		await this.manager.bot.db.users.updateConversation(this, {
			/* Save a stripped-down version of the chat history in the database. */
			history: this.history.map(entry => ({
				id: entry.output.id,
				input: entry.input,
				output: this.responseMessageToDatabase(entry.output)
			}))
		});

		/* If the user has a running pay-as-you plan, charge them for the usage. */
		await this.charge({
			model, tone, interaction: result, db: options.db
		});

		/* If messages should be collected in the database, insert the generated message. */
		if (!this.manager.bot.dev) await this.manager.bot.db.users.updateInteraction(
			{
				completedAt: new Date().toISOString(),
				requestedAt: before.toISOString(),

				id: result.output.id,

				input: result.input,
				output: this.responseMessageToDatabase(result.output),

				model: model.id,
				tone: tone.id
			}
		);

		/* How long to apply the cool-down for */
		const cooldown: number | null = this.cooldownTime(options.db, this.model(options.db));
		if (cooldown !== null) this.cooldown.use(cooldown);

		return {
			...result, tries
		};
	}

	public cooldownTime(db: DatabaseInfo, model: ChatSettingsModel): number | null {
		/* Subscription type of the user */
		const type: UserSubscriptionType = this.manager.bot.db.users.type(db);
		if (type.type === "plan" && type.location === "user") return null;

		if (type.type === "plan" && type.location === "guild") {
			/* Cool-down, set by the server */
			const guildCooldown: number = this.manager.bot.db.settings.get<number>(db.guild!, "limits:cooldown");
			return guildCooldown * 1000;
		}
		
		/* Cool-down duration & modifier */
		const baseModifier: number = CONVERSATION_COOLDOWN_MODIFIER[type.type].multiplier && !model.premiumOnly
			? CONVERSATION_COOLDOWN_MODIFIER[type.type].multiplier! : 1;

		/* Cool-down modifier, set by the model */
		const modelModifier: number = model.options.cooldown && model.options.cooldown.multiplier
			? model.options.cooldown.multiplier
			: 1;

		const baseDuration: number = model.options.cooldown && model.options.cooldown.time && model.premiumOnly
			? model.options.cooldown.time
			: CONVERSATION_COOLDOWN_MODIFIER[type.type].time ?? this.cooldown.options.time;

		const finalDuration: number = baseDuration * baseModifier * modelModifier;
		return Math.round(finalDuration);
	}

	public cooldownResponse(db: DatabaseInfo): Response {
		return new Response()
			.addEmbeds(this.cooldownMessage(db))
			.setEphemeral(true);
	}

	public cooldownMessage(db: DatabaseInfo): EmbedBuilder[] {
		/* Subscription type of the user */
		const subscriptionType = this.manager.bot.db.users.type(db);
		const additional: EmbedBuilder[] = [];
		
		if (!subscriptionType.premium) {
			additional.push(
				new EmbedBuilder()
					.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})**, your cool-down will be lowered to **a few seconds** only, with **unlimited** messages per day.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
					.setColor("Orange")
			);
			
		} else if (subscriptionType.premium && subscriptionType.location === "guild") {
			if (subscriptionType.type === "subscription") {
				additional.push(
					new EmbedBuilder()
						.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})** for yourself, the cool-down will be lowered to only **a few seconds**, with **unlimited** messages per day.\n**Premium** *also includes further benefits, view \`/premium\` for more*. ✨`)
						.setColor("Orange")
				);

			} else if (subscriptionType.type === "plan") {
				/* Cool-down, set by the server */
				const guildCooldown: number = this.manager.bot.db.settings.get<number>(db.guild!, "limits:cooldown");

				additional.push(
					new EmbedBuilder()
						.setDescription(`✨ The server owners have configured a cool-down of **${guildCooldown} seconds** for this server, using the **Pay-as-you-go 📊** plan.\n${db.user.subscription !== null || db.user.plan !== null ? `*You can configure the **priority** of Premium in \`/settings\`*.` : ""}`)
						.setColor("Orange")
				);
			}
		}

		if (!subscriptionType.premium && additional[0]) additional[0].setDescription(`${additional[0].data.description!}\n\nYou can also reduce your cool-down for **completely free**, by simply voting for us on **[top.gg](${this.manager.bot.vote.voteLink(db.user)})**. 📩\nAfter voting, run \`/vote\` and press the **Check your vote** button.`)

		this.manager.bot.db.metrics.changeCooldownMetric({
			chat: "+1"
		});

		return [
			new EmbedBuilder()
				.setTitle("Whoa-whoa... slow down ⌛")
				.setDescription(`I'm sorry, but I can't keep up with your requests. You can talk to me again <t:${Math.floor((this.cooldown.state.startedAt! + this.cooldown.state.expiresIn! + 1000) / 1000)}:R>. 😔`)
				.setColor("Yellow"),

			...additional
		];
	}

	public async charge(options: ChatChargeOptions): Promise<UserPlanChatExpense | null> {
		/* Subscription type of the user */
		const type: UserSubscriptionType = this.manager.bot.db.users.type(options.db);
		if (type.type !== "plan") return null;

		const db = options.db[type.location];
		if (!db || db.plan === null || !this.manager.bot.db.plan.active(db)) return null;

		/* Calculated credit amount */
		const amount: number | null = this.calculateChargeAmount(options);
		if (amount === null) return null;

		/* Add the charge to the user's plan. */
		const charge = await this.manager.bot.db.plan.expenseForChat(options.db, {
			bonus: options.model.id === "gpt-4" ? 0.05 : 0.20,
			used: amount,
			
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
				cost += (image.duration / 1000) * 0.0023;
			});
		}

		return cost > 0 ? cost : null;
	}

	public async pushToHistory(entry?: ChatInteraction): Promise<void> {
		/* Add the entry to this cluster first. */
		if (entry) this.history.push(entry);

		/* Then, broadcast the change to all other clusters. */
		await this.manager.bot.client.cluster.broadcastEval(((client: BotDiscordClient, context: { id: string; history: ChatInteraction[]; cluster: number }) => {
			if (client.bot.data.id !== context.cluster) {
				const c: Conversation | null = client.bot.conversation.get(context.id);

				if (c !== null) {
					c.history = context.history;
					c.applyResetTimer();
				}
			}
		}) as any, {
			context: {
				id: this.id,
				history: this.history.map(e => ({ ...e, trigger: null, reply: null })),
				cluster: this.manager.bot.data.id
			},

			timeout: 5 * 1000
		}).catch(() => {});
	}

	/* Previous message sent in the conversation */
	public get previous(): ChatInteraction | null {
		if (this.history.length === 0) return null;
		return this.history[this.history.length - 1];
	}

	public get userIdentifier(): string {
		return this.user.id;
	}

	public get id(): string {
		return this.user.id;
	}

    private responseMessageToDatabase(message: ResponseMessage): DatabaseResponseMessage {
        return {
            ...message,
            images: message.images ? message.images.map(i => ({ ...i, data: i.data.toString() })) : undefined
        };
    }

    private databaseToResponseMessage(message: DatabaseResponseMessage): ResponseMessage {
        return {
            ...message,
            images: message.images ? message.images.map(i => ({ ...i, data: ImageBuffer.load(i.data) })) : undefined
        };
    }
}