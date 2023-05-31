import { Message } from "discord.js";
import chalk from "chalk";

import { ChatClient as ChatClient, ChatClientResult } from "../chat/client.js";
import { ModerationResult } from "../moderation/moderation.js";
import { ResponseMessage } from "../chat/types/message.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { OpenAIManager } from "../openai/openai.js";
import { ConversationManager } from "./manager.js";
import { Conversation } from "./conversation.js";

import { GPTGenerationErrorType } from "../error/gpt/generation.js";
import { GPTGenerationError } from "../error/gpt/generation.js";
import { ChatGuildData } from "../chat/types/options.js";


/** Session cost data */
export const SessionCostProducts: SessionCostProduct[] = [
    {
        name: "gpt-3.5-turbo-0301",
        calculate: tokens => ({
            completion: (tokens.completion / 1000) * 0.002,
            prompt: (tokens.prompt / 1000) * 0.002
        })
    },

    {
        name: "gpt-4-0314",
        calculate: tokens => ({
            completion: (tokens.completion / 1000) * 0.06,
            prompt: (tokens.prompt / 1000) * 0.03
        })
    }
]

interface SessionCostTokens {
    /* Cost for the prompt tokens */
    prompt: number;

    /* Cost for the completion tokens */
    completion: number;
}

interface SessionCostProduct {
    name: string;

    calculate: (tokens: SessionCostTokens) => SessionCostTokens;
}

export interface SessionCost {
    tokens: number;
    cost: number;
}

interface SessionCostResponseJSON {
    object: "list";
    data: SessionCostResponseEntry[];
}

interface SessionCostResponseEntry {
    aggregation_timestamp: number;
    n_requests: number;
    operation: "completion";
    snapshot_id: string;
    n_context: number;
    n_context_tokens_total: number;
    n_generated: number;
    n_generated_tokens_total: number;
}
/** Session cost data */

/** Session subscription data */
interface SessionSubscriptionResponseJSON {
    object: "billing_subscription";
    has_payment_method: boolean;
    soft_limit_usd: number;
    hard_limit_usd: number;
}

export interface SessionSubscription {
    /* Whether the session has an attached payment method */
    hasPaymentMethod: boolean;

    /** Soft & hard usage limits */
    soft: number;
    hard: number;
}
/** Session subscription data */


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
    onProgress: (message: ResponseMessage) => Promise<void> | void;

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
        if (this.locked) throw new Error("Session is busy");
        this.locked = true;

        /* Initialize the OpenAI manager. */
        await this.ai.setup(this.credentials.token);

        this.locked = false;
        this.state = SessionState.Running;
    }

    /**
     * Shut down the session & make it unusable.
     * @param permanent Whether to disable the session for the entire run-time of the bot
     */
    public async stop(status: StopState = StopState.Normal): Promise<void> {
        this.locked = true;

        switch (status) {
            case StopState.Permanent:
                this.manager.bot.logger.debug(`Session ${chalk.bold(this.id)} has been disabled permanently.`);
                this.state = SessionState.Disabled;

                break;

            case StopState.Normal:
                this.state = SessionState.Inactive;
                break;
        }

        this.locked = false;
    }

    /**
     * Get information about maximum usage limits of the session.
     * @returns Session subscription information
     */
    private async subscription(): Promise<SessionSubscription> {
        /* Fetch the /subscription endpoint. */
        const response = await fetch(
            "https://api.openai.com/dashboard/billing/subscription",
            { headers: this.ai.headers() }
        );

        /* Get the response data. */
        const body: SessionSubscriptionResponseJSON = await response.json();

        return {
            hasPaymentMethod: body.has_payment_method,

            hard: body.hard_limit_usd,
            soft: body.soft_limit_usd
        };
    }

    /**
     * Calculate how much was approximately used for the model on this session, this month.
     * @returns Total cost & used tokens
     */
    private async cost(): Promise<SessionCost> {
        const now: Date = new Date();

        /* Get the time frame to fetch usage data from. */
        const month: string = String(now.getMonth() + 1).padStart(2, "0");
        const date: string = String(now.getDate()).padStart(2, "0");
        const year: string = String(now.getFullYear()).padStart(2, "0");

        /* Fetch the /usage endpoint. */
        const response = await fetch(
            `https://api.openai.com/v1/usage?date=${year}-${month}-${date}`,
            { headers: this.ai.headers() }
        );

        /* If the request failed, return some placeholder data. */
        if (response.status !== 200) return {
            tokens: 0,
            cost: 0
        };

        /* Get the response data. */
        const body: SessionCostResponseJSON = await response.json();

        /* Product information about the GPT models to get */
        const products: SessionCostProduct[] = SessionCostProducts.filter(p => p.name === "gpt-3.5-turbo-0301" || p.name === "gpt-4-0314")!;

        let filteredData = body.data.filter(
            ({ snapshot_id }) => products.some(p => p.name === snapshot_id)
        );

        let totalTokens = filteredData.reduce(
            (value, { n_context_tokens_total, n_generated_tokens_total }) => {
                return value + n_context_tokens_total + n_generated_tokens_total;
            }, 0
        );

        let totalCost = filteredData.reduce(
            (value, { n_context_tokens_total, n_generated_tokens_total, snapshot_id }) => {
                const product: SessionCostProduct = products.find(p => p.name === snapshot_id)!;
                const cost = product.calculate({ completion: n_generated_tokens_total, prompt: n_context_tokens_total });

                return value + cost.completion + cost.prompt;
            }, 0
        );

        return {
            tokens: totalTokens,
            cost: totalCost
        };
    }

    public async usage(): Promise<SessionCost & SessionSubscription> {
        return {
            ...await this.cost(),
            ...await this.subscription()
        };
    }

    /**
     * Generate ChatGPT's response for the specified prompt.
     * @param options Generation options 
     * 
     * @throws Any exception that may occur
     * @returns Given chat response
     */
    public async generate({ prompt, conversation, onProgress, trigger, db, guild, partial }: GenerationOptions): Promise<ChatClientResult> {
        if (this.state === SessionState.Disabled) throw new GPTGenerationError({
            type: GPTGenerationErrorType.SessionUnusable
        });

        /* If someone tries to generate something during initialization, throw an exception. */
        if (!this.active) throw new Error("Session is still starting");

        /* If the session is locked, throw an exception. */
        if (this.locked) throw new Error("Session is busy");
        
        try {
            const started: number = Date.now();
            this.generating = true;

            /* Send the request, to complete the prompt. */
            const data = await this.client.ask({
                progress: onProgress, conversation,
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

    /* Whether the session can be deemed usable */
    public get usable(): boolean {
        return !this.locked && this.state !== SessionState.Disabled;
    }
}