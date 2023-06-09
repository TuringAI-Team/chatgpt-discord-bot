import { Collection, Message } from "discord.js";
import { setTimeout } from "timers/promises";
import { randomUUID } from "crypto";
import chalk from "chalk";

import { GPT_MAX_CONTEXT_LENGTH, GPT_MAX_GENERATION_LENGTH, countChatMessageTokens, getChatMessageLength, getPromptLength, isPromptLengthAcceptable } from "../conversation/utils/length.js";
import { ChatAnalyzedImage, ChatImageAttachment, ChatImageAttachmentExtractors, ChatBaseImage, ChatInputImage, ChatImageAttachmentExtractorData } from "./types/image.js";
import { ChatSettingsModel, ChatSettingsModelPromptType } from "../conversation/settings/model.js";
import { ChatDocument, ChatDocumentExtractors, ChatExtractedDocument } from "./types/document.js";
import { MessageType, PartialResponseMessage, ResponseMessage } from "./types/message.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ChatGenerationOptions, ModelGenerationOptions } from "./types/options.js";
import { ChatInput, ChatInteraction } from "../conversation/conversation.js";
import { ChatModel, ModelCapability, ModelType } from "./types/model.js";
import { OpenAIChatMessage } from "../openai/types/chat.js";
import { LanguageManager } from "../db/types/locale.js";
import { Session } from "../conversation/session.js";
import { Utils } from "../util/utils.js";

/* List of available model providers */
import { ChatModels } from "./models/index.js";

export interface ChatClientResult {
    input: ChatInput;
    output: ResponseMessage;
}

type PromptParts = {
    Initial: OpenAIChatMessage;
    Personality?: OpenAIChatMessage;
    Other?: OpenAIChatMessage;
    Context?: OpenAIChatMessage;
}

interface PromptMessageBuildOptions {
    prompt: string;
    output?: string;
    images?: ChatInputImage[];
    documents?: ChatDocument[];
}

export interface PromptData {
    /* The formatted prompt; all parts concatenated */
    prompt: string;

    /* The various parts of the prompt */
    parts: PromptParts;

    /* Maximum amount of tokens to use for GPT-3 */
    max: number;

    /* Amount of tokens used for the prompt */
    length: number;
}

export interface PromptContext {
    date: string;
    time: string;
}

export const OtherPrompts = {
    /* This prompt is added if the user attaches an image to the message, in order to make it easier for the model to understand */
    ImageAttachments:
`
From now on, you are a text and image-based AI. Users will be able to attach images to their message for you to understand using the format: '[<image type> #<index> = <file name>: "<image description>". [optional: "Detected text: "<corrected OCR text>"]]'.
You must be able to act like you can see and understand these attached images, act as if you can see, view and read them, referring to them as attached image/emoji/sticker/etc.
Prioritize detected text from the image, fix OCR errors, and use logic and common sense to understand the image. Don't ask the user about the description, treat it as an image attachment.
`.trim(),

    /* This prompt is added if the user attaches a text document, e.g. file or HasteBin link */
    Documents:
`
To attach text documents, users may use the format: '[Document <document type> #<index> = <file name>: """<file content>"""]'.
You must incorporate the content of the attached documents as if the user directly included them in their message, but you may answer follow-up questions about the document appropriately.
You must pretend to "view" these text attachments, do not talk about the format used.
`.trim(),

    /* This prompt continues a cut-off message */
    Continue: "Continue the message where you left off, don't add any additional explanations or repeat anything you said before."
}

/* Hard limit for the prompt generation loop */
const PROMPT_GEN_LOOP_LIMIT: number = 50

export class ChatClient {
    /* Session - in charge of this instance */
    public readonly session: Session;

    /* Model type -> execution function mappings */
    private readonly models: Collection<ModelType, ChatModel>;

    constructor(session: Session) {
        this.session = session;
        this.models = new Collection();

        /* Initialize the models. */
        for (const model of ChatModels) {
            /* Create an instance of the model provider. */
            const instance = new model(this);
            this.models.set(instance.settings.type, instance);
        }
    }

    /**
     * Get the current date, formatted for the chat model.
     * @returns Current date
     */
	public date(date?: Date): string {
		const today = date ?? new Date();

		const dd   = String(today.getDate()).padStart(2, "0");
		const mm   = String(today.getMonth() + 1).padStart(2, "0");
		const yyyy = today.getFullYear();

		return `${yyyy}-${mm}-${dd}`;
	}

    /**
     * Get the current time, formatted for the chat model.
     * @returns Current time
     */
	public time(): string {
		const today = new Date();
		return `${String(today.getUTCHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")} UTC`;
	}

    public promptContext(): PromptContext {
        return {
            date: this.date(),
            time: this.time()
        };
    }

    /**
     * Get the formatted initial prompt, for the specified model type & tone.
     * @returns Final, formatted prompt
     */
    public async initialPrompt<T = any>(options: ModelGenerationOptions, data?: T): Promise<string> {
        /* Final formatter result */
        const result: string = (await options.settings.format({
            options, data,

            conversation: options.conversation, 
            client: this
        })).trim();

        /* Language selected by the user */
        const language: string = LanguageManager.modelLanguageName(options.conversation.manager.bot, options.db.user);
        const hasCapability: boolean = options.model.hasCapability(ModelCapability.UserLanguage);

        if (!hasCapability || (hasCapability && language === "English")) return result;
        else return `${result}\nAdditionally, I must prioritize responding to the user in the language "${language}".`;
    }

    /**
     * Construct the prompt to pass to the chat completion request.
     * @param options Generation options
     * 
     * @returns Constructed & formatted prompt
     */
    public async buildPrompt<T = any>(options: ModelGenerationOptions, data?: T): Promise<PromptData> {
        /* Formatted prompt message */
        let messages: Partial<PromptParts> = {};
        let tokens: number = 0;

        /* The user's subscription type */
        const subscriptionType = options.conversation.manager.bot.db.users.type(options.db);

        /* The user's selected tone */
        const tone = options.conversation.tone(options.db);
        
        const { type, location } = this.session.manager.bot.db.users.type(options.db);

        const limits = {
            context: this.session.manager.bot.db.settings.get<number>(options.db[location]!, "limits:contextTokens"),
            generation: this.session.manager.bot.db.settings.get<number>(options.db[location]!, "limits:generationTokens")
        };

        /* Actual maximum token count for the prompt */
        let maxContextLength: number = type !== "plan"
            ? Math.min(limits.context, options.settings.options.history.context ?? GPT_MAX_CONTEXT_LENGTH[subscriptionType.type])
            : Math.min(options.settings.options.history.maxTokens, limits.context);

        /* Maximum generation length */
        let maxGenerationTokens: number = type !== "plan"
            ? Math.min(limits.generation, options.settings.options.history.generation ?? GPT_MAX_GENERATION_LENGTH[subscriptionType.type])
            : limits.generation;

        /* If the prompt itself exceeds the length limit, throw an error. */
        if (!isPromptLengthAcceptable(options.prompt, maxContextLength)) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Length
        });

        /* Initial, formatted prompt */
        const initial: string = await options.conversation.manager.session.client.initialPrompt(options, data);

        /* If the prompt is supposed to be passed verbatim to the model, ... */
        if (options.settings.options.prompt.type === ChatSettingsModelPromptType.Raw) {
            return {
                length: getPromptLength(initial),
                max: maxGenerationTokens,
                prompt: initial,

                parts: {
                    Initial: {
                        content: initial,
                        role: "system"
                    }
                }
            };
        }

        const tags: Record<"Assistant" | "User", () => string> = {
            Assistant: () => "Assistant:",
            User: () => "User:"
        };

        const imagesPrompt = (images: ChatInputImage[]) =>
            images.map((image, index) => `[${Utils.titleCase(image.type)} #${index + 1} = ${image.name}: "${image.description}"${image.text ? `, detected text: "${image.text}"` : ""}]`).join("\n");

        const documentsPrompt = (documents: ChatDocument[]) => 
            documents.map((document, index) => `[${Utils.titleCase(document.type)} document #${index + 1} = name "${document.name}": """\n${document.content}\n"""]`).join("\n");

        const buildMessage = ({ prompt, output, images, documents }: PromptMessageBuildOptions) => {
            let final: string = "";
            final += `${tags.User()}\n`;

            if (images && images.length > 0) final += `${imagesPrompt(images)}\n`;
            if (documents && documents.length > 0) final += `${documentsPrompt(documents)}\n`;

            if (prompt.length > 0) final += `${prompt}\n`;

            final += "\n";
            final += `${tags.Assistant()}\n`;

            if (output) final += output;
            return final;
        }

        /* Current iteration count, as a safety measure */
        let i: number = 0;

        do {
            i++;

            /* Which messages to use */
            let history: ChatInteraction[] = options.conversation.history;
            if (options.settings.options.history.messages) history = history.slice(-options.settings.options.history.messages);

            /* Try to construct a prompt below the maximum token count & add the initial prompt. */
            messages.Initial = {
                content: initial,
                role: "assistant"
            };

            /* Add the additional tone modifier to the prompt, if needed. */
            if (tone.options.prompt !== null) {
                const message: OpenAIChatMessage | null = await tone.format({
                    options,

                    conversation: options.conversation, 
                    client: this
                })
                
                if (message !== null) messages.Personality = message;
            }

            /* Additional prompts to include */
            let additional: string[] = [];

            if (options.images.length > 0 || history.some(e => e.input.images && e.input.images.length > 0)) additional.push(OtherPrompts.ImageAttachments);
            if (options.documents.length > 0 || history.some(e => e.input.documents && e.input.documents.length > 0)) additional.push(OtherPrompts.Documents);

            /* If the user attached images to the message, add another pre-prompt. */
            if (additional.length > 0) messages.Other = {
                content: additional.join("\n\n"),
                role: "system"
            };

            /* Add all message history entries to the conversation prompt. */
            messages.Context = {
                role: "system",

                content: `${history.map(entry =>
                    buildMessage({ prompt: entry.input.content, output: entry.output.text, images: entry.input.images, documents: entry.input.documents })
                ).join("\n\n")}${history.length > 0 ? "\n\n" : ""}${buildMessage({ prompt: options.prompt, images: options.images, documents: options.documents })}`
            };

            /* Tokens used for the initial prompt */
            const currentContextLength: number = getChatMessageLength(...[ messages.Initial, messages.Other, messages.Personality ].filter(Boolean) as OpenAIChatMessage[]);

            /* Calculate the amount of used tokens. */
            tokens = countChatMessageTokens(Object.values(messages));

            /* If the max context length exceeds even the length of the initial prompt itself, account for that too. */
            if (maxContextLength < currentContextLength) maxContextLength += currentContextLength;

            /* If a too long user prompt is causing the prompt to be too long, throw an error. */
            if (history.length === 0 && maxContextLength - tokens <= 0) throw new GPTGenerationError({
                type: GPTGenerationErrorType.Length
            });
            
            /* If the prompt is too long, remove the oldest history entry & try again. */
            if (maxContextLength - tokens <= 0) options.conversation.history.shift();
            else break;
            
        } while (maxContextLength - tokens <= 0 && i < PROMPT_GEN_LOOP_LIMIT);

        if(i >= PROMPT_GEN_LOOP_LIMIT) throw new Error("Reached the prompt iteration limit");

        /* Update the maximum generation tokens, to avoid possible conflicts with the model's limits. */
        maxGenerationTokens = Math.min(
            options.settings.options.history.maxTokens - tokens,
            maxGenerationTokens
        ) - 1;

        return {
            prompt: Object.values(messages).map(message => message.content).join("\n\n"),
            parts: messages as PromptParts,
            max: maxGenerationTokens,
            length: tokens
        };
    }

    /**
     * Clean up the generated response message.
     * @param content Content to clean
     * 
     * @returns Cleaned message content
     */
    private clean(content: string): string {
        return content.trim();
    }

    private messageImageAttachmentData(message: Message): ChatImageAttachmentExtractorData {
        return {
            bot: this.session.manager.bot,
            message
        };
    }

    /**
     * Get all usable Discord image attachments.
     * @returns Usable Discord Image attachments
     */
    public async findMessageImageAttachments(message: Message): Promise<ChatImageAttachment[]> {
        const total: ChatImageAttachment[] = [];

        for (const extractor of ChatImageAttachmentExtractors) {
            const condition: boolean = extractor.condition(this.messageImageAttachmentData(message));
            if (!condition) continue;

            total.push(...(await extractor.extract(this.messageImageAttachmentData(message)) ?? []).map(extracted => ({
                ...extracted, type: extractor.type
            })));
        }

        return total;
    }

    private async messageImages(attachments: ChatImageAttachment[]): Promise<ChatBaseImage[]> {
        return Promise.all(attachments
            .map(async attachment => {
                const data = await Utils.fetchBuffer(attachment.url);
                return { ...attachment, data: data! };
            }));
    }

    /**
     * Analyze all messages attached on Discord.
     * @param options Generation options
     * 
     * @returns All analyzed images, if applicable
     */
    private async analyzeImages(options: ChatGenerationOptions & { model: ChatModel, attachments: ChatBaseImage[] }): Promise<ChatInputImage[]> {
        /* All analyzed images */
        const results: ChatInputImage[] = [];
        const start: number = Date.now();

        for (const attachment of options.attachments) {
            /* Show a notice to the Discord user. */
            if (options.progress) options.progress({
                id: "", raw: null, type: MessageType.Notice,
                text: `Looking at **\`${attachment.name}\`**`
            });

            try {
                /* When the generation started */
                const before: number = Date.now();

                /* Run the model-specific image analyzer, and gather all results. */
                const result: ChatAnalyzedImage = await options.model.analyze({
                    ...options, attachment
                });

                results.push({
                    name: attachment.name, type: attachment.type, url: attachment.url, duration: Date.now() - before,
                    ...result
                });

            } catch (error) {
                if (options.progress) options.progress({
                    id: "", raw: null, type: MessageType.Notice,
                    text: `Failed to look at **\`${attachment.name}\`**, continuing`
                });

                await this.session.manager.bot.error.handle({
                    title: "Failed to analyze image", error
                });
                
                await setTimeout(5000);
            }
        }

        if (this.session.manager.bot.dev) this.session.manager.bot.logger.debug(
            `Analyzed ${chalk.bold(results.length)} image${results.length > 1 ? "s" : ""}, attached by ${chalk.bold(options.conversation.user.tag)}, using model ${chalk.bold(ModelType[options.model.settings.type])} in ${chalk.bold(`${Date.now() - start}ms`)}.`
        );

        return results;
    }

    /**
     * Fetch all possible documents attached to a message.
     * @param message Message to analyze
     * 
     * @returns All found message documents
     */
    private async messageDocuments(options: ChatGenerationOptions): Promise<ChatDocument[]> {
		const total: ChatDocument[] = [];

        for (const extractor of ChatDocumentExtractors) {
            const condition: boolean = extractor.condition(options.trigger);
            if (!condition) continue;

            try {
                const result: ChatExtractedDocument[] | null = await extractor.extract(options.trigger);
                if (result === null || result.length === 0) continue;

                total.push(...result.map(extracted => ({
                    ...extracted, type: extractor.type
                })));

            } catch (error) {
                if (options.progress) options.progress({
                    id: "", raw: null, type: MessageType.Notice,
                    text: `Failed to fetch a text document, continuing`
                });

                await this.session.manager.bot.error.handle({
                    title: "Failed to fetch a text document", error
                });
                
                await setTimeout(5000);
            }
        }

        return total;
    }

    public hasMessageDocuments(message: Message): boolean {
        for (const extractor of ChatDocumentExtractors) {
            if (extractor.condition(message)) return true;
            else continue;
        }

        return false;
    }

    public async ask(options: ChatGenerationOptions): Promise<ChatClientResult> {
        /* Model provider to use */
        const model = this.modelForSetting(options.conversation.model(options.db));
        const settings = options.conversation.model(options.db);

        /* Random message identifier */
        const id: string = randomUUID();

        /* First off, gather all applicable Discord image attachments. */
        const attachments: ChatBaseImage[] = await this.messageImages(
            await this.findMessageImageAttachments(options.trigger)
        );
        
        let images: ChatInputImage[] = [];

        /* Try to analyze all images passed as attachments. */
        if (attachments.length > 0) images = await this.analyzeImages({
            ...options, attachments, model
        });

        /* Then, try to fetch all possible text documents in the message. */
        const documents: ChatDocument[] = await this.messageDocuments(options);

        /* Middle-man progress handler, to clean up the partial responses */
        const progress = async (message: PartialResponseMessage | ResponseMessage) => {
            if (options.progress) options.progress({
                ...message, id,
                raw: null, images: message.images ?? [],

                type: message.type ?? MessageType.Chat,
                text: this.clean(message.text)
            });
        }

        /* Execute the corresponding handler. */
        const result = await model.complete({
            ...options, progress, images, model, settings, documents
        });

        return {
            input: {
                content: options.prompt,
                
                images: images.length > 0 ? images : undefined,
                documents: documents.length > 0 ? documents : undefined
            },

            output: {
                ...result, id,
                
                raw: result.raw ?? null,
                images: result.images ?? undefined,
    
                type: result.type ?? MessageType.Chat,
                text: this.clean(result.text)
            }
        };
    }

    public modelForType<T extends ChatModel = ChatModel>(type: ModelType): T {
        /* Model provider to use */
        const model: T | null = (this.models.get(type) ?? null) as T | null;

        /* If the model does not exist, throw an important error. */
        if (model === null) {
            this.session.manager.bot.logger.error(`No model provider exists for type ${chalk.bold(ModelType[type])}; this isn't supposed to happen!`);
            throw new Error("No model provider found");
        }

        return model;
    }

    public modelForSetting<T extends ChatModel = ChatModel>(model: ChatSettingsModel): T {
        return this.modelForType(model.options.type);
    }
}