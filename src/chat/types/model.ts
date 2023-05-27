import { ChatResetOptions, GPTImageAnalyzeOptions, ModelGenerationOptions } from "./options.js";
import { PartialResponseMessage } from "./message.js";
import { ChatAnalyzedImage } from "./image.js";
import { ChatClient } from "../client.js";

export enum ModelCapability {
    /* The model can view images */
    ImageViewing = "imageViewing",

    /* The model only works in guilds */
    GuildOnly = "guildOnly",

    /* The model can be set to respond in the user's language */
    UserLanguage = "userLanguage"
}

export enum ModelType {
    /* OpenAI ChatGPT API */
    OpenAIChat,

    /* OpenAI ChatGPT API with plugin support */
    OpenAIPlugins,

    /* OpenAI's completion API */
    OpenAICompletion,

    /** Replicate text inference */
    Replicate,

    /** OpenPlayground website */
    Nat,

    /** Replication of Discord's Clyde AI */
    Clyde,

    /** Turing API */
    Turing,

    /** Turing Alan model, utilizing various AI technologies */
    TuringAlan,

    /** Debug model provider */
    Dummy
}

export interface ModelOptions {
    /* Name of the model */
    name: string;

    /* Type of model */
    type: ModelType;

    /* Whether the model accepts images */
    capabilities: ModelCapability[];
}

export type ConstructorModelOptions = Pick<ModelOptions, "name" | "type"> & {
    capabilities?: ModelCapability[];
}

export abstract class ChatModel {
    protected readonly client: ChatClient;

    /* Information about this model */
    public readonly settings: ModelOptions;

    constructor(client: ChatClient, options: ConstructorModelOptions) {
        this.settings = {
            ...options,
            capabilities: options.capabilities ?? []
        };

        this.client = client;
    }

    /**
     * This function is called before the conversation of a user is reset, using the `/reset` command.
     * @param options Various reset options
     */
    public async reset(options: ChatResetOptions): Promise<void> {
        /* Stub */
    }

    /**
     * Analyze the given message attachment, and return the analyzed results.
     * @param options Image analyzing options
     * 
     * @returns Analyzed image
     */
    public async analyze(options: GPTImageAnalyzeOptions): Promise<ChatAnalyzedImage> {
        /* Analyze & describe the image. */
        const result = await this.client.session.manager.bot.db.description.describe({
            input: options.attachment,
            useOCR: true
        });

        return {
            description: result.result.description,
            text: result.result.ocr
        };
    }

    /**
     * Generate a response from this model.
     * @param options Generation options
     * 
     * @returns Final generation results
     */
    public abstract complete(options: ModelGenerationOptions): Promise<PartialResponseMessage>;

    /**
     * Check whether the model has access to the specified capability.
     * @param capability The capability to check for
     * 
     * @returns Whether it has the capability
     */
    public hasCapability(capability: ModelCapability): boolean {
        return this.settings.capabilities.includes(capability);
    }
}