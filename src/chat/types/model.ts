import { GPTImageAnalyzeOptions, ModelGenerationOptions } from "./options.js";
import { ImageOCRResult, detectText } from "../../util/ocr.js";
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
     * Analyze the given message attachment, and return the analyzed results.
     * @param options Image analyzing options
     * 
     * @returns Analyzed image
     */
    public async analyze(options: GPTImageAnalyzeOptions): Promise<ChatAnalyzedImage> {
        /* Image analyzing results */
        let prediction: object | null = null!;
        let ocr: ImageOCRResult | null = null! as ImageOCRResult;

        await Promise.allSettled([
            new Promise<void>(async (resolve, reject) => {
                /* Get the interrogation model. */
                const model = await this.client.session.manager.bot.replicate.api.models.get("andreasjansson", "blip-2");
                
                /* Run the interrogation request, R.I.P money. */
                prediction = await this.client.session.manager.bot.replicate.api.run(`andreasjansson/blip-2:${model.latest_version!.id}`, {
                    input: {
                        image: options.attachment.url,

                        caption: false,
                        question: "What does this image show? Describe in detail.",
                        context: "",
                        use_nucleus_sampling: true,
                        temperature: 1
                    },

                    wait: {
                        interval: 750
                    }
                }).catch(reject) ?? null;

                resolve();
            }),

            new Promise<void>(async resolve => {
                /* Additionally, run OCR text recognition, to further improve results. */
                ocr = await detectText(this.client.session.manager.bot, {
                    url: options.attachment.url, engine: 5
                }).catch(() => null);

                resolve();
            })
        ]);

        if (prediction === null) throw new Error("Failed to get BLIP detection results");

        return {
            description: (prediction as string).replaceAll("Caption: ", ""),
            text: ocr && ocr.content ? ocr.content.replaceAll("\r\n", "\n") : null
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