import { Awaitable, Message } from "discord.js";

import { Conversation } from "../../conversation/conversation.js";
import { ChatMedia, ChatMediaType } from "./types/media.js";
import { ResponseMessage } from "../types/message.js";
import { ChatModel } from "../types/model.js";
import { ChatClient } from "../client.js";

interface ChatMediaHandlerSettings {
    /** Internal type of this handler */
    type: ChatMediaType;

    /** Which message to display to the user while extracting this media type */
    message: string | string[];
}

export interface ChatMediaHandlerRunOptions {
    progress?: (message: ResponseMessage) => Promise<void> | void;
    conversation: Conversation;
    message: Message;
    model: ChatModel;
}

export type ChatMediaHandlerPromptsOptions = ChatMediaHandlerRunOptions & {
    media: ChatMedia[];
}

export type ChatMediaHandlerHasOptions = Omit<ChatMediaHandlerRunOptions, "model">

export abstract class ChatMediaHandler<RawMedia = any, FinalMedia = RawMedia> {
    public readonly settings: ChatMediaHandlerSettings;
    protected readonly client: ChatClient;

    constructor(client: ChatClient, settings: ChatMediaHandlerSettings) {
        this.settings = settings;
        this.client = client;
    }

    /**
     * Check whether the specified message contains this type of media.
     * @param message The message to check
     * 
     * @returns Whether it contains this type of media
     */
    public abstract has(options: ChatMediaHandlerHasOptions): Awaitable<boolean>;

    /**
     * Extract all of the media attachments & run all additional steps (e.g. OCR, BLIP2 for images) on them.
     * @param options Media run options
     * 
     * @returns A list of all final media attachments
     */
    public abstract run(options: ChatMediaHandlerRunOptions): Promise<FinalMedia[]>;

    /** Additional prompt, to explain the attached media */
    public abstract prompt(media: FinalMedia): string;

    /** The initial prompt, explaining how this type of media works to the AI */
    public abstract initialPrompt(): string;
}