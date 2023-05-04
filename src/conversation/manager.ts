import { APIUser, Collection, Snowflake, User } from "discord.js";

import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { Conversation } from "./conversation.js";
import { Generator } from "./generator.js";
import { Session } from "./session.js";
import { Bot } from "../bot/bot.js";

/* Manager in charge of managing all conversations */
export class ConversationManager {
    public readonly bot: Bot;

    /* The session itself */
    public session: Session;

    /* List of currently running conversations */
    public readonly conversations: Collection<Snowflake, Conversation>;

    /* Response generator; used for handling Discord messages */
    public readonly generator: Generator;

    /* Whether the conversation manager was fully initialized */
    public active: boolean;

    constructor(bot: Bot) {
        this.bot = bot;
        this.active = false;

        /* Create the Discord message generator. */
        this.generator = new Generator(this.bot);
        
        /* Initialize the lists with empty values. */
        this.conversations = new Collection();
        this.session = null!;
    }

    /**
     * Set up the sessions.
     * @returns How many sessions were initialized
     */
    public async setup(): Promise<void> {
        /* Create a new session. */
        this.session = new Session(this, {
            token: this.bot.app.config.openAI.key,
            type: "openai"
        });

        /* Try to initialize the session. */
        await this.session.init();
        this.active = true;
    }

    /**
     * Shut down all of the sessions.
     */
    public async stop(): Promise<void> {
        /* Shut down the session. */
        await this.session.stop();
        this.active = false;
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
        const conversation: Conversation = new Conversation(this, this.session, user);
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
        conversation.history = [];

        /* Remove the conversation from the collection, let Node do the rest. */
        this.conversations.delete(conversation.user.id);
    }

    /**
     * Get the currently-active session of a user, if they already have one.
     * @param user User to get the session of
     * 
     * @returns Currentlly-active session, or `null` if none exists
     */
    public get(user: User | APIUser | string): Conversation | null {
        return this.conversations.get(typeof user === "string" ? user : user.id) ?? null;
    }

    /**
     * Check whether a user already has a session running.
     * @param user User to check for
     * 
     * @returns Whether the user already has a session running
     */
    public has(user: User): boolean {
        return this.conversations.get(user.id) != undefined && this.conversations.get(user.id)!.active;
    }
}