import { EmbedBuilder, Message, User } from "discord.js";

import { DatabaseConversation, DatabaseInfo, DatabaseResponseMessage, RawDatabaseConversation } from "../db/managers/user.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ChatInputImage, ImageBuffer } from "../chat/types/image.js";
import { check, ModerationResult } from "./moderation/moderation.js";
import { Cooldown, CooldownModifier } from "./utils/cooldown.js";
import { ResponseMessage } from "../chat/types/message.js";
import { GenerationOptions, Session } from "./session.js";
import { ChatClientResult } from "../chat/client.js";
import { ConversationManager } from "./manager.js";
import { GPTAPIError } from "../error/gpt/api.js";
import { GeneratorOptions } from "./generator.js";
import { BotDiscordClient } from "../bot/bot.js";
import { ChatTone, ChatTones } from "./tone.js";
import { Utils } from "../util/utils.js";

export interface ChatInput {
	/* The input message itself; always given */
	content: string;

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

/* How many tries to allow to retry after an error occurred duration generation */
const CONVERSATION_ERROR_RETRY_MAX_TRIES: number = 10

/* Usual cool-down for interactions in the conversation */
export const CONVERSATION_COOLDOWN_MODIFIER = {
	Free: 1,
	Voter: 0.5,
	GuildPremium: 0.4,
	UserPremium: 0.1
}

export const CONVERSATION_DEFAULT_COOLDOWN: CooldownModifier = {
	time: 150 * 1000
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

	/* Session, in charge of generating responses to prompts */
	public session: Session;

	/* Whether the conversation is active & ready */
	public active: boolean;

	/* Whether the client is locked, because it is initializing or shutting down */
	public generating: boolean;

	/* History of prompts & responses */
	public history: ChatInteraction[];

	/* Last interaction with this conversation */
	public updatedAt: number | null;

	/* Tone & personality for this conversation */
	public tone: ChatTone;

	/* Whether the conversation is currently generating an image */
	public generatingImage: boolean;

	/* Cool-down manager */
	public cooldown: Cooldown;

	/* How long this conversation stays cached in memory */
	public ttl: number;
	private timer: NodeJS.Timeout | null;

	/* The conversation's database entry */
	public db: DatabaseConversation | null;

	constructor(manager: ConversationManager, session: Session, user: User) {
		this.manager = manager;

		this.cooldown = new Cooldown({ time: CONVERSATION_DEFAULT_COOLDOWN.time! });

		this.ttl = 30 * 60 * 1000;
		this.timer = null;
		this.db = null;

		this.user = user;

		/* Set up the session. */
		this.session = session;

		/* Set up the conversation data. */
		this.generatingImage = false;
		this.history = [];

		/* Set the default tone. */
		this.tone = ChatTones[0];

		/* Set up some default values. */
		this.updatedAt = null;
		this.active = false;
		this.generating = false;
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
		/* Try to assign the saved tone in the database. */
		const tone: ChatTone | null = ChatTones.find(t => t.id === data.tone) ?? null;
		if (tone !== null) await this.changeTone(tone, false);

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

			await this.pushToClusters();
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

	/**
	 * Initialize the conversation.
	 * This also gets called after each "reset", in order to maintain the creation time & future data.
	 */
	public async init(): Promise<void> {
		/* Make sure that the user exists in the database. */
		await this.manager.bot.db.users.fetchUser(this.user);

        /* Update the conversation entry in the database. */
        if (this.history.length === 0) await this.manager.bot.db.users.updateConversation(this, {
                created: Date.now(),
                id: this.id,
                active: true,
				
				tone: this.tone.id,
				history: null
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
	 * @param updatedAt Time when the last interaction with this conversation occured, optional
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
	 * Set the current conversation tone, by identifier.
	 * *Used by clusters to set the tone globally*.
	 * 
	 * @param id Identifier of the tone
	 */
	public setTone(id: string): void {
		const tone: ChatTone | null = ChatTones.find(t => t.id === id) ?? null;
		if (tone !== null) this.tone = tone;
	}

	/**
	 * Change the tone for this conversation.
	 * @param tone Tone to switch to
	 */
	public async changeTone(tone: ChatTone, apply: boolean = true): Promise<void> {
		/* If the specified tone is already set, ignore this. */
		if (this.tone.id === tone.id) return;

		/* Reset the conversation history first, as this will get rid of issues related to memory. */
		await this.reset(false);
		this.tone = tone;

		/* Change the tone of all other clusters. */
		await this.manager.bot.client.cluster.broadcastEval(((client: BotDiscordClient, context: { id: string; tone: string }) => {
			const c: Conversation | null = client.bot.conversation.get(context.id);
			if (c !== null) c.setTone(context.tone);
		}) as any, {
			context: {
				id: this.id,
				tone: this.tone.id
			}
		}).catch(() => {});

		/* Update the database entry too. */
        if (apply) await this.manager.bot.db.users.updateConversation(this, { tone: this.tone.id });
		this.applyResetTimer();
	}

	public async setImageGenerationStatus(status: boolean): Promise<void> {
		if (this.generatingImage === status) return;
		this.generatingImage = status;

		/* Change the status for all other clusters. */
		await this.manager.bot.client.cluster.broadcastEval(((client: BotDiscordClient, context: { id: string; status: boolean }) => {
			const c: Conversation | null = client.bot.conversation.get(context.id);
			if (c !== null) c.generatingImage = status;
		}) as any, {
			context: {
				id: this.id,
				status: this.generatingImage
			}
		}).catch(() => {});

		this.applyResetTimer();
	}

	/**
	 * Reset the conversation, and clear its history.
	 */
	public async reset(remove: boolean = true): Promise<void> {
		/* Reset the conversation data. */
		this.applyResetTimer();
		this.history = [];

		/* Remove the entry in the database. */
        if (remove) await this.manager.bot.db.client
            .from(this.manager.bot.db.users.collectionName("conversations"))
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
				data = await this.session.generate(options);

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
					// this.session.manager.bot.logger.warn(`Request by ${chalk.bold(options.conversation.user.tag)} failed, retrying [ ${chalk.bold(tries)}/${chalk.bold(CONVERSATION_ERROR_RETRY_MAX_TRIES)} ] ->`, error);

					/* Display a notice message to the user on Discord. */
					options.onProgress({
						id: "", raw: null, type: "Notice",
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
		} while (tries < CONVERSATION_ERROR_RETRY_MAX_TRIES && data === null && this.generating);

		/* Unlock the conversation after generation has finished. */
		this.generating = false;

		/* Update the reset timer. */
		this.applyResetTimer();

		/* If the data still turned out `null` somehow, ...! */
		if (data === null) throw new Error("What.");

		/* Check the generated message using the moderation endpoint, again. */
		const moderation: ModerationResult | null = await check({
			conversation: this, db: options.db,

			content: data.output.text,
			message: options.message,
			source: "bot",
			
			reply: false
		});

		const result: ChatInteraction = {
			input: data.input,
			output: data.output,

			trigger: options.trigger,
			reply: null,

			moderation,
			time: Date.now()
		};

		/* Add the response to the history. */
		await this.pushToClusters(result);

		/* Also update the last-updated time and message count in the database for this conversation. */
		await this.manager.bot.db.users.updateConversation(this, {
			/* Save a stripped-down version of the chat history in the database. */
			history: this.history.map(entry => ({
				id: entry.output.id,
				input: entry.input,
				output: this.responseMessageToDatabase(entry.output)
			}))
		});

		/* If messages should be collected in the database, insert the generated message. */
		if (!this.manager.bot.dev) await this.manager.bot.db.users.updateInteraction(
			{
				completedAt: new Date().toISOString(),
				requestedAt: before.toISOString(),

				id: result.output.id,

				input: result.input,
				output: this.responseMessageToDatabase(result.output),

				tone: this.tone.id
			}
		);

		/* How long to apply the cool-down for */
		const cooldown: number = this.cooldownTime(options.db, this.tone);

		/* Activate the cool-down. */
		if (!this.manager.bot.app.config.discord.owner.includes(this.user.id)) this.cooldown.use(cooldown);

		return {
			...result,
			tries
		};
	}

	public cooldownTime(db: DatabaseInfo, tone: ChatTone): number {
		/* Cool-down duration & modifier */
		const baseModifier: number = tone.settings.cooldown && tone.settings.cooldown.time && tone.settings.premium
			? 1
			: CONVERSATION_COOLDOWN_MODIFIER[this.manager.bot.db.users.subscriptionType(db)];

		/* Cool-down modifier, set by the tone */
		const toneModifier: number = tone.settings.cooldown && tone.settings.cooldown.multiplier
			? tone.settings.cooldown.multiplier
			: 1;

		const baseDuration: number = tone.settings.cooldown && tone.settings.cooldown.time && tone.settings.premium
			? tone.settings.cooldown.time
			: this.cooldown.options.time;

		const finalDuration: number = baseDuration * baseModifier * toneModifier;
		return Math.round(finalDuration);
	}

	public cooldownMessage(db: DatabaseInfo): EmbedBuilder[] {
		/* Subscription type of the user */
		const subscriptionType = this.manager.bot.db.users.subscriptionType(db);
		const additional: EmbedBuilder[] = [];
		
		if (subscriptionType !== "UserPremium") {
			if (subscriptionType === "Free" || subscriptionType === "Voter") {
				additional.push(
					new EmbedBuilder()
						.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})**, your cool-down will be lowered to **a few seconds** only, with **unlimited** messages per day.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
						.setColor("Orange")
				);
				
			} else if (subscriptionType === "GuildPremium") {
				additional.push(
					new EmbedBuilder()
						.setDescription(`✨ By buying **[Premium](${Utils.shopURL()})** for yourself, the cool-down will be lowered to only **a few seconds**, with **unlimited** messages per day.\n**Premium** *also includes further benefits, view \`/premium info\` for more*. ✨`)
						.setColor("Orange")
				);
			}
		}

		if (additional[0]) additional[0].setDescription(`${additional[0].data.description!}\n\nYou can also reduce your cool-down for **completely free**, by simply voting for us on **[top.gg](https://top.gg/en/bot/${this.manager.bot.client.user!.id}/vote)**. 📩\nAfter voting, run \`/vote\` and press the **Check your vote** button.`)

		return [
			new EmbedBuilder()
				.setTitle("Whoa-whoa... slow down ⌛")
				.setDescription(`I'm sorry, but I can't keep up with your requests. You can talk to me again <t:${Math.floor((this.cooldown.state.startedAt! + this.cooldown.state.expiresIn! + 1000) / 1000)}:R>. 😔`)
				.setColor("Yellow"),

			...additional
		];
	}

	public async pushToClusters(entry?: ChatInteraction): Promise<void> {
		/* Add the entry to this cluster first. */
		if (entry) this.history.push(entry);

		/* Then, broadcast the change to all other clusters. */
		await this.manager.bot.client.cluster.broadcastEval(((client: BotDiscordClient, context: { id: string; history: ChatInteraction[] }) => {
			const c: Conversation | null = client.bot.conversation.get(context.id);

			if (c !== null) {
				c.history = context.history;
				c.applyResetTimer();
			}
		}) as any, {
			context: {
				id: this.id,
				history: this.history.map(e => ({ ...e, trigger: null, reply: null }))
			}
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