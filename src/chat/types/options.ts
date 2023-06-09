import { Guild, GuildMember, Message, TextChannel } from "discord.js";

import { ChatNoticeMessage, PartialResponseMessage, ResponseMessage } from "./message.js";
import { ChatSettingsModel } from "../../conversation/settings/model.js";
import { ChatSettingsTone } from "../../conversation/settings/tone.js";
import { Conversation } from "../../conversation/conversation.js";
import { ChatBaseImage, ChatInputImage } from "./image.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { ChatDocument } from "./document.js";
import { ChatModel } from "./model.js";

export type ModelGenerationOptions = Pick<ChatGenerationOptions, "conversation" | "trigger" | "db" | "prompt" | "guild" | "partial"> & {
    /* Which model is being used for generation */
    model: ChatModel;

    /* Which settings model is being used */
    settings: ChatSettingsModel;

    /* Function to call on partial message generation */
    progress: (message: PartialResponseMessage | ChatNoticeMessage) => Promise<void> | void;

    /* List of attached images */
    images: ChatInputImage[];

    /* List of attached text documents */
    documents: ChatDocument[];
}

export interface ChatGuildData {
    /* Guild, where the chat interaction occurred */
    guild: Guild;

    /* Channel, where the chat interaction occurred */
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

    /* Whether partial messages should be generated */
    partial: boolean;

    /* Prompt to ask */
    prompt: string;
}

export interface ChatResetOptions {
    /* Which conversation this reset request is for */
    conversation: Conversation;

    /* Which settings model is being used */
    model: ChatSettingsModel;

    /* Which settings tone is being used */
    tone: ChatSettingsTone;
}

export type GPTImageAnalyzeOptions = ChatGenerationOptions & {
    /* Message attachment to analyze */
    attachment: ChatBaseImage;
}