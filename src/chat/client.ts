import { Collection } from "discord.js";
import chalk from "chalk";

import { MaxContextLength, MaxGenerationLength, countChatMessageTokens, getChatMessageLength, getPromptLength, isPromptLengthAcceptable } from "../conversation/utils/length.js";
import { ChatSettingsModel, ChatSettingsModelPromptType } from "../conversation/settings/model.js";
import { MessageType, PartialResponseMessage, ResponseMessage } from "./types/message.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/generation.js";
import { ChatGenerationOptions, ModelGenerationOptions } from "./types/options.js";
import { ChatInput, ChatInteraction } from "../conversation/conversation.js";
import { ChatModel, ModelCapability, ModelType } from "./types/model.js";
import { OpenAIChatMessage } from "../turing/types/openai/chat.js";
import { ConversationManager } from "../conversation/manager.js";
import { LanguageManager } from "../db/types/locale.js";
import { ChatMediaManager } from "./media/manager.js";
import { ChatMedia } from "./media/types/media.js";
import { Utils } from "../util/utils.js";

export interface ChatClientResult {
    input: ChatInput;
    output: ResponseMessage;
}

type PromptParts = {
    Initial: OpenAIChatMessage;
    Personality?: OpenAIChatMessage;
    Other?: OpenAIChatMessage;
}

interface PromptMessageBuildOptions {
    prompt: string;
    output?: string;
    media?: ChatMedia[];
}

export interface PromptData {
    /** The various parts of the prompt */
    parts: PromptParts;

    /* All of the user & assistant's messages */
    messages: OpenAIChatMessage[];

    /* All of the messages, including system prompts */
    all: OpenAIChatMessage[];

    /** Maximum amount of tokens to use for the model */
    max: number;

    /** Amount of tokens used for the prompt */
    length: number;
}

export interface PromptContext {
    date: string;
    time: string;
}

export const OtherPrompts = {
    /* This prompt continues a cut-off message */
    Continue: "Continue the message where you left off, don't add any additional explanations or repeat anything you said before."
}

/* Hard limit for the prompt generation loop */
const PromptLoopLimit: number = 50

export class ChatClient {
    /* Conversation manager - in charge of this instance */
    public readonly manager: ConversationManager;

    /* Media manager - in charge of detecting various attachments in messages */
    public readonly media: ChatMediaManager;

    /* Model type -> execution function mappings */
    private readonly models: Collection<ModelType, ChatModel>;

    constructor(manager: ConversationManager) {
        this.manager = manager;
        this.models = new Collection();

        this.media = new ChatMediaManager(this);
    }

    public async setup(): Promise<void> {
		await new Promise<void>((resolve, reject) => {
			Utils.search("./build/chat/models")
				.then(async (files: string[]) => {
					await Promise.all(files.map(async path => {
						await import(path)
							.then((data: { [key: string]: any }) => {
								const list = Object.values(data).filter(data => data.name);

								for (const data of list) {
									const instance: ChatModel = new (data as any)(this);
									this.models.set(instance.settings.type, instance);
								}
							})
							.catch(reject);
					}));

					resolve();
				})
				.catch(reject);
		});

        await this.media.setup();
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
        let messages: OpenAIChatMessage[] = [];
        let parts: Partial<PromptParts> = {};
        let tokens: number = 0;

        const subscriptionType = await options.conversation.manager.bot.db.users.type(options.db);
        const tone = options.conversation.tone(options.db);
        
        const { type, location } = await this.manager.bot.db.users.type(options.db);

        const limits = {
            context: this.manager.bot.db.settings.get<number>(options.db[location]!, "limits:contextTokens"),
            generation: this.manager.bot.db.settings.get<number>(options.db[location]!, "limits:generationTokens")
        };

        /* Actual maximum token count for the prompt */
        let maxContextLength: number = type !== "plan"
            ? Math.min(limits.context, options.settings.options.history.context ?? MaxContextLength[subscriptionType.type])
            : Math.min(options.settings.options.history.maxTokens, limits.context);

        /* Maximum generation length */
        let maxGenerationTokens: number = type !== "plan"
            ? Math.min(limits.generation, options.settings.options.history.generation ?? MaxGenerationLength[subscriptionType.type])
            : limits.generation;

        /* If the prompt itself exceeds the length limit, throw an error. */
        if (!isPromptLengthAcceptable(options.prompt, maxContextLength)) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Length
        });

        /* Initial, formatted prompt */
        const initial: string = await this.initialPrompt(options, data);

        /* If the prompt is supposed to be passed verbatim to the model, ... */
        if (options.settings.options.prompt.type === ChatSettingsModelPromptType.Raw) {
            return {
                messages: [], all: [], parts: { Initial: { content: initial, role: "system" } },
                length: getPromptLength(initial), max: maxGenerationTokens
            };
        }

        const buildMessage = ({ prompt, output, media }: PromptMessageBuildOptions): OpenAIChatMessage[] => {
            const messages: OpenAIChatMessage[] = [];
            let final: string = "";

            if (media) {
                const prompts: string[] = this.media.prompts(media);
                final = prompts.map(p => `${p}\n`).join("");
            }

            if (prompt.length > 0) final += prompt;

            messages.push({ role: "user", content: final });
            if (output) messages.push({ role: "assistant", content: output });

            return messages;
        }

        /* Current iteration count, as a safety measure */
        let i: number = 0;

        do {
            i++;

            /* Which messages to use */
            let history: ChatInteraction[] = options.conversation.history.entries;
            if (options.settings.options.history.messages) history = history.slice(-options.settings.options.history.messages);

            /* Try to construct a prompt below the maximum token count & add the initial prompt. */
            parts.Initial = {
                content: initial, role: "assistant"
            };

            /* Add the additional tone modifier to the prompt, if needed. */
            if (tone.options.prompt !== null) {
                const message: OpenAIChatMessage | null = await tone.format({
                    options, conversation: options.conversation, client: this
                });
                
                if (message !== null) parts.Personality = message;
            }

            /* Additional prompts to include */
            let additional: string[] = this.media.initialPrompts(options.media);

            /* If the user attached images to the message, add another pre-prompt. */
            if (additional.length > 0) parts.Other = {
                content: additional.join("\n\n"), role: "system"
            };

            for (const entry of history) {
                messages.push(
                    ...buildMessage({ prompt: entry.input.content, output: entry.output.text, media: entry.input.media })
                );
            }

            /* Add the user's actual request. */
            messages.push(
                ...buildMessage({ prompt: options.prompt, media: options.media })
            );

            /* Tokens used for the initial prompt */
            const currentContextLength: number = getChatMessageLength(...[ parts.Initial, parts.Other, parts.Personality ].filter(Boolean) as OpenAIChatMessage[]);
            tokens = countChatMessageTokens([ ...Object.values(parts), ...messages ]);

            /* If the max context length exceeds even the length of the initial prompt itself, account for that too. */
            if (maxContextLength < currentContextLength) maxContextLength += currentContextLength;

            /* If a too long user prompt is causing the prompt to be too long, throw an error. */
            if (history.length === 0 && maxContextLength - tokens <= 0) throw new GPTGenerationError({
                type: GPTGenerationErrorType.Length
            });
            
            /* If the prompt is too long, remove the oldest history entry & try again. */
            if (maxContextLength - tokens <= 0) options.conversation.history.shift();
            else break;
            
        } while (maxContextLength - tokens <= 0 && i < PromptLoopLimit);

        if(i >= PromptLoopLimit) throw new Error("Reached the prompt iteration limit");

        /* Update the maximum generation tokens, to avoid possible conflicts with the model's limits. */
        maxGenerationTokens = Math.min(
            options.settings.options.history.maxTokens - tokens, maxGenerationTokens
        ) - 1;

        return {
            parts: parts as PromptParts, messages, all: [ ...Object.values(parts), ...messages ],
            max: maxGenerationTokens, length: tokens
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

    public async ask(options: ChatGenerationOptions): Promise<ChatClientResult> {
        /* Model provider to use */
        const model = this.modelForSetting(options.conversation.model(options.db));
        const settings = options.conversation.model(options.db);

        /* Middle-man progress handler, to clean up the partial responses */
        const progress = async (message: PartialResponseMessage | ResponseMessage) => {
            await this.manager.progress.send(options, {
                ...message, text: this.clean(message.text)
            });
        };

        /* Extract all of the various media attachments. */
        const media: ChatMedia[] = await this.media.run({
            conversation: options.conversation, message: options.trigger, progress, model
        });

        /* Execute the corresponding handler. */
        const result = await model.complete({
            ...options, progress, model, settings, media
        });

        return {
            input: {
                content: options.prompt, media: media.length > 0 ? media : undefined
            },

            output: {
                ...result, raw: result.raw ?? undefined,
    
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
            this.manager.bot.logger.error(`No model provider exists for type ${chalk.bold(ModelType[type])}; this isn't supposed to happen!`);
            throw new Error("No model provider found");
        }

        return model;
    }

    public modelForSetting<T extends ChatModel = ChatModel>(model: ChatSettingsModel): T {
        return this.modelForType(model.options.type);
    }
}