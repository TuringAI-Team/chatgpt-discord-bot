import { APIUser, Collection, Message, Snowflake, User } from "discord.js";

import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ModerationResult } from "../moderation/moderation.js";
import { ResponseMessage } from "../chat/types/message.js";
import { ChatGuildData } from "../chat/types/options.js";
import { ProgressManager } from "./utils/progress.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Conversation } from "./conversation.js";
import { ChatClient, ChatClientResult } from "../chat/client.js";
import { Generator } from "./generator.js";
import { Bot } from "../bot/bot.js";
import chalk from "chalk";

/* Message generation options */
export interface GenerationOptions {
    /* Conversation to use */
    conversation: Conversation;

    /* Discord message that invoked the generation */
    trigger: Message;

    /* Function to call on message updates */
    progress: (message: ResponseMessage) => Promise<void> | void;

    /* Guild data, if available */
    guild: ChatGuildData | null;

    /* Moderation result of the invocation message */
    moderation: ModerationResult | null;

    /* Database instances */
    db: DatabaseInfo;

    /* Prompt to use for generation */
    prompt: string;

    /* Whether partial messages should be shown */
    partial: boolean;
}

export class ConversationManager {
    public readonly bot: Bot;

    /* List of currently running conversations */
    public readonly conversations: Collection<Snowflake, Conversation>;

    /* Response generator; used for handling Discord messages */
    public readonly generator: Generator;

    /* Client, in charge of building prompts and generating the actual responses */
    public readonly client: ChatClient;

    /* The progress() callback handler; used for sending progress callbacks */
    public readonly progress: ProgressManager;

    /* Whether the conversation manager was fully initialized */
    public active: boolean;

    constructor(bot: Bot) {
        this.bot = bot;
        this.active = false;

        /* Create the Discord message generator. */
        this.generator = new Generator(this.bot);
        this.progress = new ProgressManager(this);
        this.client = new ChatClient(this);
        
        /* Initialize the map with empty values. */
        this.conversations = new Collection();
    }

    /**
     * Set up the sessions.
     * @returns How many sessions were initialized
     */
    public async setup(): Promise<void> {
        await this.client.setup();
        this.active = true;
    }

    /**
     * Generate ChatGPT's response for the specified prompt.
     * @param options Generation options 
     * 
     * @throws Any exception that may occur
     * @returns Given chat response
     */
    public async generate({ prompt, conversation, progress, trigger, db, guild, partial }: GenerationOptions): Promise<ChatClientResult> {
        if (!this.active) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Inactive
        });
        
        try {
            /* Send the request, to complete the prompt. */
            const data = await this.client.ask({
                progress, conversation, trigger, prompt, db, guild, partial
            });

            return data;

        } catch (error) {
            throw error;
        }
    }

    /**
     * Create a new conversation for the specified Discord user, bound to the specified thread.
     * @param user Discord user to create a session for
     * 
     * @returns Newly-created session 
     */
    public async create(user: User): Promise<Conversation> {
        /* If the user already has a conversation, return it instead. */
        if (this.has(user)) return this.get(user)!;

        /* Create a new conversation. */
        const conversation: Conversation = new Conversation(this, user);
        this.conversations.set(user.id, conversation);

        /* If the conversation hasn't been loaded yet, try to load it from the database. */
        await conversation.loadIfNotActive();

        return this.get(user)!;
    }

    /**
     * Delete a conversation from memory, to save memory usage. It will be loaded again, once the user needs it.
     * @param conversation Conversation to delete
     */
    public delete(conversation: Conversation): void {
        if (this.bot.dev) this.bot.logger.debug("Conversation", chalk.bold(`@${conversation.user.username}`), "was reset due to inactivity.");

        if (conversation.timer !== null) clearTimeout(conversation.timer);
        conversation.history = [];

        /* Remove the conversation from the collection, let Node do the rest. */
        this.conversations.delete(conversation.id);
    }

    /**
     * Get the currently-active session of a user, if they already have one.
     * @param user User to get the session of
     * 
     * @returns Currentlly-active session, or `null` if none exists
     */
    public get(user: User | APIUser | { id: string } | string): Conversation | null {
        return this.conversations.get(typeof user === "string" ? user : user.id) ?? null;
    }

    /**
     * Check whether a user already has a session running.
     * @param user User to check for
     * 
     * @returns Whether the user already has a session running
     */
    public has(user: User): boolean {
        return this.get(user) !== null;
    }
}