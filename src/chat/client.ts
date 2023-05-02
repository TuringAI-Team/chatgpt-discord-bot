import { ChannelType, Collection, ForumChannel, GuildChannel, GuildEmoji, Message, StageChannel, TextChannel, VoiceChannel } from "discord.js";
import { setTimeout } from "timers/promises";
import { randomUUID } from "crypto";
import chalk from "chalk";

import { GPT_MAX_CONTEXT_LENGTH, GPT_MAX_GENERATION_LENGTH, countChatMessageTokens, getChatMessageLength, isPromptLengthAcceptable } from "../conversation/utils/length.js";
import { ChatAnalyzedImage, ChatImageAttachment, ChatImageAttachmentExtractors, ChatBaseImage, ChatInputImage } from "./types/image.js";
import { ChatInput, ChatInteraction, Conversation } from "../conversation/conversation.js";
import { MessageType, PartialResponseMessage, ResponseMessage } from "./types/message.js";
import { GPTGenerationError, GPTGenerationErrorType } from "../error/gpt/generation.js";
import { ChatGenerationOptions, ModelGenerationOptions } from "./types/options.js";
import { ChatModel, ModelCapability, ModelType } from "./types/model.js";
import { ChatTone, TonePromptType } from "../conversation/tone.js";
import { OpenAIChatMessage } from "../openai/types/chat.js";
import { handleError } from "../util/moderation/error.js";
import { LanguageManager } from "../db/types/locale.js";
import { ChatDocument, ChatDocumentExtractors, ChatDocumentType, ChatExtractedDocument } from "./types/document.js";
import { Session } from "../conversation/session.js";
import { ClydePromptData } from "./models/clyde.js";
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
    Context: OpenAIChatMessage;
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

export interface BuildPromptOptions {
    type: PromptType;
}

export type PromptType = "ChatGPT" | "GPT3" | "Nat" | "Clyde" | "Vicuna" | "Custom"
export type PromptFormatter = <T = any>(time: string, date: string, conversation: Conversation, options: ModelGenerationOptions, data?: T) => string

export const Prompts: Record<PromptType, PromptFormatter> = {
    ChatGPT: (time, date) => 
`
I am ChatGPT, a large language model trained by OpenAI, released in November 2022.
I must provide engaging & entertaining responses.

Current date & time: ${time}, ${date}
Knowledge cut-off: September 2021
`,

    GPT3: (time, date) =>
`
I am GPT-3, an autoregressive language model, initially released in 2022 and updated in November 2022, by OpenAI that uses deep learning to produce human-like text.
I must answer as concisely as possible. I must provide engaging & entertaining responses.

Current date & time: ${time}, ${date}
Knowledge cut-off: 2021
`,

    Nat: (time, date, conversation) =>
`
${conversation.tone.prompt!}
I must provide engaging & entertaining responses.

Current date & time: ${time}, ${date}
`,

    Clyde: ((time: string, date: string, conversation: Conversation, options: ModelGenerationOptions, data: ClydePromptData) => {
        /* All custom emojis on the guild */
        const emojis: GuildEmoji[] = Array.from(options.guild!.guild.emojis.cache.values())
            .slice(undefined, 25);

        /* All text channels on the guild */
        const channels: GuildChannel[] = Array.from(options.guild!.guild.channels.cache.values())
            .filter(c => c.type === ChannelType.GuildText || c.type === ChannelType.GuildVoice)
            .slice(undefined, 15) as GuildChannel[];

        const userList: string = data.users.map(user =>
            `<u:${user.name}>${user.suffix ? ` (${user.suffix})` : ""}\n${Object.entries(user).filter(([ key, value ]) => value !== null && key !== "name" && key !== "suffix").map(([ name, value ]) => ` - ${name}: ${value}`).join("\n")}`
        ).join("\n\n");

        return `
I am an AI named Clyde - and I am currently chatting in a Discord server.
I am Discord's AI chat bot, released on the 3rd March, 2023.

Consider the following in your responses:
- I must be conversational
- I must add Unicode emojis at the end of my messages to be more playful in my responses
- I can write spoilers using spoiler tags. For example, ||At the end of The Sixth Sense it is revealed that he is dead||.
- I can also reply with a gif, by using <g:...>, for example if I wanted to send a cat gif, I would do: <g:cat>. Gifs are a great way to represent emotion, and I should use them in my replies from time to time to add flavor to the conversation.
- I can mention users by writing their name between <u:...>, for example if I wanted to mention myself, I should say <u:Clyde>.
${emojis.length > 0 ? `- I can use custom emojis from this server, by sending them as "<e:...>" verbatim. I must replace ... with the custom emoji name to use. I can see all custom emojis below. I must prioritize server emojis over Unicode ones.` : ""}
- I have access to all channels on the server, and can see various information about them, including who's in voice channels and the topic of each channel.
- I must be able to send other people's and user's avatars by saying "<a:...>" verbatim, replacing "..." with their username, to display their avatar in chat.
- I must be able to send a Discord invite to this server, by simplying saying <:i:> verbatim.
- I can see the nickname, roles, and join date of users in the chat.

${emojis.length > 0 ? `Custom server emoji names on this server, I must use "<e:...emoji name...>" format to send them:\n${emojis.map(e => e.name).join(", ")}` : ""}

Channels on this server:
${channels.map(c => {
    if (c instanceof TextChannel) return `<c:${c.name}>${c.topic ? ` - topic: ${c.topic}` : ""}${c.nsfw ? " - nsfw channel" : ""}`;
    else if (c instanceof VoiceChannel) return `<c:${c.name}> - voice channel - connected users: ${c.members.size > 0 ? c.members.map(m => `<u:${m.user.username}>`).join(", ") : "none"}`;
    else if (c instanceof StageChannel) return `<c:${c.name}> - stage voice channel`;
    else if (c instanceof ForumChannel) return `<c:${c.name}> - forum channel`;
    
}).join("\n")}

Information about my environment:
 - The server I am in is called: ${options.guild!.guild.name}
 - The server is owned by: <u:${options.guild!.owner.user.username}>
 - The server has ${options.guild!.guild.memberCount} members${options.guild!.guild.approximatePresenceCount ? `, ${options.guild!.guild.approximatePresenceCount} members of them are online` : ""}.
${options.guild!.guild.description ? `- The server has the description: "${options.guild!.guild.description}"` : ""}
 - The channel I am in is called: <c:${options.guild!.channel.name}>

I can use this information about the chat participants in the conversation in your replies. Use this information to answer questions, or add flavor to your responses.

${userList}

I am not a personal assistant and cannot complete tasks for people. I cannot access any other information on Discord. I can't see images or avatars. When discussing my limitations, I must tell the user these things could be possible in the future.

Current date & time: ${date}, ${time}
Knowledge cut-off: 2021
`
    }) as any,

    Vicuna: (time, date) => 
`
I am Vicuna, a fine-tuned language model based on LLaMA 13B, and was trained on ChatGPT responses.
I must provide engaging & entertaining responses.

Current date & time: ${time}, ${date}
Knowledge cut-off: September 2021, like ChatGPT
`,

    Custom: (time, date, conversation) =>
`
${conversation.tone.prompt ?? "I am a chat assistant, I must provide engaging & entertaining responses."}

Current date & time: ${time}, ${date}
`
}

export const OtherPrompts = {
    /* This prompt is added if the user attaches an image to the message, in order to make it easier for the model to understand */
    ImageAttachments:
`
To attach images, users may use the format: '[<image type> #<index> = <file name>: "<image description>". [optional: "Detected text: "<corrected OCR text>"]]'.
You must be able to "see" these attached images, act as if you can see, view and read them, referring to them as attached image/emoji/sticker/etc.
Prioritize detected text from the image, fix OCR errors, and use logic and common sense to understand the image. Don't ask the user about the description.
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
     * Get the current date, formatted for GPT.
     * @returns Current date, formatted for GPT
     */
	public date(date?: Date): string {
		const today = date ?? new Date();

		const dd   = String(today.getDate()).padStart(2, "0");
		const mm   = String(today.getMonth() + 1).padStart(2, "0");
		const yyyy = today.getFullYear();

		return `${yyyy}-${mm}-${dd}`;
	}

    /**
     * Get the current time, formatted for GPT.
     * @returns Current time, formatted for GPT
     */
	public time(): string {
		const today = new Date();
		return `${String(today.getUTCHours()).padStart(2, "0")}:${String(today.getMinutes()).padStart(2, "0")} UTC`;
	}

    /**
     * Get the formatted initial prompt, for the specified model type & tone.
     * 
     * @param client Chat client
     * @param conversation The conversation that is connected with this prompt & completion
     * @param type Type of the prompt
     * 
     * @returns Final, formatted prompt
     */
    public initialPrompt<T = any>(conversation: Conversation, options: ModelGenerationOptions, type: PromptType, data?: T): string {
        /* Get the formatter for the specified prompt */
        const formatter: PromptFormatter = conversation.tone.settings.type === TonePromptType.Initial ? Prompts["Custom"] : Prompts[type];
        const result: string = formatter(this.time(), this.date(), conversation, options, data).trim();

        /* Language selected by the user */
        const language: string = LanguageManager.modelLanguageName(conversation.manager.bot, options.db.user);
        const hasCapability: boolean = options.model.hasCapability(ModelCapability.UserLanguage);

        if (!hasCapability || (hasCapability && language === "English")) return result;
        else return `${result}\n- Additionally, you must prioritize responding to the user in the language "${language}".`
    }

    /**
     * Construct the prompt to pass to the chat completion request.
     * @param options Generation options
     * 
     * @returns Constructed & formatted prompt
     */
    public async buildPrompt<T = any>(options: ModelGenerationOptions, type: PromptType, data?: T): Promise<PromptData> {
        /* Formatted prompt message */
        let messages: Partial<PromptParts> = {};
        let tokens: number = 0;

        /* The user's subscription type */
        const subscriptionType = options.conversation.manager.bot.db.users.subscriptionType(options.db);

        /* If the prompt itself exceeds the length limit, throw an error. */
        if (options.prompt.length >= 2000) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Length
        });

        /* Actual maximum token count for the prompt */
        let maxContextLength: number = options.conversation.tone.settings.contextTokens ?? GPT_MAX_CONTEXT_LENGTH[subscriptionType];

        /* Maximum generation length */
        const maxGenerationTokens: number = options.conversation.tone.settings.generationTokens ?? GPT_MAX_GENERATION_LENGTH[subscriptionType];

        /* If the prompt itself exceeds the length limit, throw an error. */
        if (!isPromptLengthAcceptable(options.prompt, maxContextLength)) throw new GPTGenerationError({
            type: GPTGenerationErrorType.Length
        });

        /* Initial, formatted prompt */
        const initial: string = options.conversation.session.client.initialPrompt(options.conversation, options, type, data);

        const tags: Record<"Assistant" | "User", () => string> = {
            Assistant: () => "Assistant:",
            User: () => "User:"
        };

        const imagesPrompt = (images: ChatInputImage[]) =>
            images.map((image, index) => `[${Utils.titleCase(image.type)} #${index + 1} = ${image.name}: "${image.description}"${image.text ? `, detected text: "${image.text}"` : ""}]`).join("\n");

        const documentsPrompt = (documents: ChatDocument[]) => 
            documents.map((document, index) => `[${Utils.titleCase(document.type)} document #${index + 1} = name "${document.name}": """\n${document.content}\n"""]`).join("\n");

        interface MessageBuildOptions {
            prompt: string;
            output?: string;
            images?: ChatInputImage[];
            documents?: ChatDocument[];
        }

        const buildMessage = ({ prompt, output, images, documents }: MessageBuildOptions) => {
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

        do {
            /* Which messages to use */
            let history: ChatInteraction[] = options.conversation.history;
            if (options.conversation.tone.settings.maxMessages) history = history.slice(-options.conversation.tone.settings.maxMessages);

            /* Try to construct a prompt below the maximum token count & add the initial prompt. */
            messages.Initial = {
                content: initial,
                role: "assistant"
            };

            /* Add the additional tone modifier to the prompt, if needed. */
            if (options.conversation.tone.prompt !== null && options.conversation.tone.settings.type === TonePromptType.Personality) {
                messages.Personality = {
                    content: options.conversation.tone.format()!,
                    role: "assistant"
                };
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

            /* Calculate the amount of used tokens. */
            tokens = countChatMessageTokens(Object.values(messages));

            /* Tokens used for the initial prompt */
            const currentContextLength: number = getChatMessageLength(messages.Initial!);

            /* If the max context length exceeds even the length of the initial prompt itself, account for that too. */
            if (maxContextLength < currentContextLength) maxContextLength += currentContextLength;

            /* If a too long user prompt is causing the prompt to be too long, throw an error. */
            if (history.length === 0 && maxContextLength - tokens <= 0) throw new GPTGenerationError({
                type: GPTGenerationErrorType.Length
            });
            
            /* If the prompt is too long, remove the oldest history entry & try again. */
            if (maxContextLength - tokens <= 0) options.conversation.history.shift();
            else break;
        } while (maxContextLength - tokens <= 0);

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

    /**
     * Get all usable Discord image attachments.
     * @returns Usable Discord Image attachments
     */
    public findMessageImageAttachments(message: Message): ChatImageAttachment[] {
        const total: ChatImageAttachment[] = [];

        for (const extractor of ChatImageAttachmentExtractors) {
            const condition: boolean = extractor.condition(message);
            if (!condition) continue;

            total.push(...(extractor.extract(message) ?? []).map(extracted => ({
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
                /* Run the model-specific image analyzer, and gather all results. */
                const result: ChatAnalyzedImage = await options.model.analyze({
                    ...options, attachment
                });

                results.push({
                    name: attachment.name, type: attachment.type,
                    ...result
                });

            } catch (error) {
                if (options.progress) options.progress({
                    id: "", raw: null, type: MessageType.Notice,
                    text: `Failed to look at **\`${attachment.name}\`**, continuing`
                });

                await handleError(this.session.manager.bot, {
                    title: "Failed to analyze image",
                    error: error as Error, reply: false
                });
                
                await setTimeout(5000);
            }
        }

        this.session.manager.bot.logger.debug(
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

                await handleError(this.session.manager.bot, {
                    title: "Failed to fetch a text document",
                    error: error as Error, reply: false
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
        const model = this.modelForTone(options.conversation.tone);

        /* Random message identifier */
        const id: string = randomUUID();

        /* First off, gather all applicable Discord image attachments. */
        const attachments: ChatBaseImage[] = await this.messageImages(this.findMessageImageAttachments(options.trigger));
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
            ...options, progress, images, model, documents
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

    public modelForTone<T extends ChatModel = ChatModel>(tone: ChatTone): T {
        return this.modelForType(tone.settings.model ?? ModelType.OpenAIChat);
    }
}