import { Message } from "discord.js";

import { ChatClient as ChatClient, ChatClientResult } from "../chat/client.js";
import { ModerationResult } from "../moderation/moderation.js";
import { ResponseMessage } from "../chat/types/message.js";
import { ChatGuildData } from "../chat/types/options.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { OpenAIManager } from "../openai/manager.js";
import { ConversationManager } from "./manager.js";
import { Conversation } from "./conversation.js";

import { GPTGenerationErrorType } from "../error/gpt/generation.js";
import { GPTGenerationError } from "../error/gpt/generation.js";

export interface ChatCredentials {
    token: string;
}

export enum StopState {
    /* Normal shutdown of the session */
    Normal,

    /* Disable the session for the entire run-time of the application */
    Permanent
}

export enum SessionState {
    /* The session is active */
    Running,
    
    /* The session has not been initialized yet */
    Inactive,

    /* The session has been disabled for the run-time of the bot */
    Disabled
}

interface SessionDebugData {
    /* How many messages were generated in this session */
    count: number;

    /* Total response generation time, in milliseconds */
    duration: number;

    /* How many tokens were generated & used for prompts in this session */
    tokens: number;
}

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


export class Session {
    /* Manager in charge of controlling this conversation */
    public readonly manager: ConversationManager;

    /* ChatGPT client */
    public readonly client: ChatClient;

    /* OpenAI manager */
    public readonly ai: OpenAIManager;

    /* Credentials used for logging in */
    public readonly credentials: ChatCredentials;

    /* Whether the client is active & authenticated */
    public state: SessionState;

    /* Whether the client is locked, because it is initializing or shutting down */
    public locked: boolean;

    /* Whether the client is currently generating a response */
    public generating: boolean;

    /* Various debug data about this session */
    public debug: SessionDebugData;

    constructor(manager: ConversationManager, credentials: ChatCredentials) {
        this.manager = manager;
        this.credentials = credentials;

        /* Create a new OpenAI manager for the message generation client. */
        this.ai = new OpenAIManager(this.manager.bot);

        /* Set up the message generation client. */
        this.client = new ChatClient(this);

        /* Set up some default values. */
        this.state = SessionState.Inactive;
        this.generating = false;
        this.locked = false;
        
        this.debug = {
            count: 0,
            duration: 0,
            tokens: 0
        };
    }

    /**
     * Set up the session and log in using the given credentials in the configuration.
     * @throws An exception, if the initialization failed
     */
    public async init(): Promise<void> {
        /* If the session was disabled because of insufficient credits, throw an error. */
        if (this.state === SessionState.Disabled) throw new Error("Session has been disabled permanently");

        /* If the session has already been initialized; don't do anything. */
        if (this.active) return;

        /* If the conversation has been locked, don't initialize the session. */
        if (this.locked) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Busy
        })
        
        this.state = SessionState.Running;
    }

    /**
     * Generate ChatGPT's response for the specified prompt.
     * @param options Generation options 
     * 
     * @throws Any exception that may occur
     * @returns Given chat response
     */
    public async generate({ prompt, conversation, progress, trigger, db, guild, partial }: GenerationOptions): Promise<ChatClientResult> {
        if (this.state === SessionState.Disabled) throw new GPTGenerationError({
            type: GPTGenerationErrorType.SessionUnusable
        });

        /* If someone tries to generate something during initialization, throw an exception. */
        if (!this.active) throw new Error("Session is still starting");

        /* If the session is locked, throw an exception. */
        if (this.locked) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Busy
        })
        
        try {
            const started: number = Date.now();
            this.generating = true;

            /* Send the request, to complete the prompt. */
            const data = await this.client.ask({
                progress, conversation,
                trigger, prompt, db, guild, partial
            });

            if (data.output.raw && data.output.raw.usage) this.debug.tokens += data.output.raw.usage.prompt + data.output.raw.usage.completion;
            
            this.debug.duration += Date.now() - started;
            this.debug.count++;

            return data;

        } catch (error) {
            throw error;

        } finally {
            this.generating = false;
        }
    }

    /* Unique identifier of the session */
    public get id(): string {
        return this.credentials.token.slice(-8);
    }

    public get active(): boolean {
        return this.state === SessionState.Running;
    }
}