import { Guild, GuildMember, Message, TextChannel } from "discord.js";

import { ChatNoticeMessage, PartialResponseMessage, ResponseMessage } from "./message.js";
import { Conversation } from "../../conversation/conversation.js";
import { ChatBaseImage, ChatInputImage } from "./image.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { ChatDocument } from "./document.js";
import { ChatModel } from "./model.js";

export type ModelGenerationOptions = Pick<ChatGenerationOptions, "conversation" | "trigger" | "db" | "prompt" | "guild"> & {
    /* Which model is being used for generation */
    model: ChatModel;

    /* Function to call on partial message generation */
    progress: (message: PartialResponseMessage | ChatNoticeMessage) => Promise<void> | void;

    /* List of attached images */
    images: ChatInputImage[];

    /* List of attached text documents */
    documents: ChatDocument[];
}

export interface ChatGuildData {
    /* Guild, where the chat interaction occured */
    guild: Guild;

    /* Channel, where the chat interaction occured */
    channel: TextChannel;

    /* Owner of the guild, as a user */
    owner: GuildMember;

    /* Guild member instance of the user */
    member: GuildMember;
}

export interface ChatGenerationOptions {
    /* Function to call on partial message generation */
    progress?: (message: ResponseMessage) => Promise<void> | void;

    /* Which conversation this generation request is for */
    conversation: Conversation;

    /* Guild, where this request was executed from */
    guild: ChatGuildData | null;

    /* Discord message that invoked the generation */
    trigger: Message;

    /* Database instances */
    db: DatabaseInfo;

    /* Prompt to ask */
    prompt: string;
}

export type GPTImageAnalyzeOptions = ChatGenerationOptions & {
    /* Message attachment to analyze */
    attachment: ChatBaseImage;
}