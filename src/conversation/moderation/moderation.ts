import translate from "@iamtraction/google-translate";
import { EmbedBuilder, Message } from "discord.js";

import { OpenAIModerationsCategoryScores, OpenAIModerationsData } from "../../openai/types/moderation.js";
import { ModerationSource, sendModerationMessage } from "../../util/moderation/moderation.js";
import { AutoModerationActionData, executeModerationFilters } from "./automod/automod.js";
import { AutoModerationFilter } from "./automod/filters.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Conversation } from "../conversation.js";

interface OpenAIModerationScore {
    key: keyof OpenAIModerationsCategoryScores;
    value: number;
}

interface AdditionalModerationOptions {
    /* Which Stable Diffusion model was used */
    model?: string;

    /* Whether NSFW content is allowed */
    nsfw: boolean;
}

interface ModerationOptions {
    conversation: Conversation;
    message?: Message;
    reply?: boolean;

    source: ModerationSource;
    db: DatabaseInfo;
    content: string;

    /* Other data */
    filter?: (action: AutoModerationFilter) => boolean;
    additional?: AdditionalModerationOptions;
}

type ImagePromptModerationOptions = Pick<ModerationOptions, "conversation" | "db" | "content"> & AdditionalModerationOptions

type TranslationModerationOptions = Pick<ModerationOptions, "conversation" | "db" | "content"> & {
    source: "translationPrompt" | "translationResult";
}

type DescribeModerationOptions = Pick<ModerationOptions, "conversation" | "db" | "content">

export interface ModerationTranslationResult {
    /* Translated content */
    content: string;

    /* Detected language */
    detected: string;
}

export interface ModerationResult {
    /* Translated flagged content */
    translation?: ModerationTranslationResult;

    /* Whether the message was flagged */
    flagged: boolean;

    /* Whether the message should be completely blocked */
    blocked: boolean;

    /* Auto moderation filter result */
    auto?: AutoModerationActionData;

    /* OpenAI Moderations API result */
    data?: OpenAIModerationsData;

    /* OpenAI Moderaitons API most-likely flag */
    highest?: OpenAIModerationScore;

    /* Source of the moderation request */
    source: ModerationSource;
}

export type DatabaseModerationResult = ModerationResult & { reference: string }
export type SerializedModerationResult = ModerationResult

/**
 * Check a generation request for flagged content before executing.
 * 
 * If the message contains profanity, ask the user using a Discord button interaction,
 * whether they actually want to execute the request.
 * 
 * @param options Generation options
 * @returns Moderation results
 */
export const check = async ({ conversation, db, content, reply, message, source, filter, additional }: ModerationOptions): Promise<ModerationResult> => {
    /* Run the AutoMod filter on the message. */
    const auto: AutoModerationActionData | null = await executeModerationFilters({
        conversation, content, db, source,
        filterCallback: filter ? (_, action) => filter(action) : undefined
    }); 

    /* If this moderation request is related to image generation, run the Turing API filter too. */
    const turing = (source === "image" || source === "video") && additional
        ? await conversation.manager.bot.turing.filter(content, additional.model).catch(() => null)
        : null;

    /* Whether the message should be completely blocked */
    let blocked: boolean = auto !== null && auto.type !== "flag";

    /* Whether the message has been flagged as inappropriate */
    let flagged: boolean = blocked || auto !== null && auto.type === "flag";

    /* If the Turing filter was used, do the additional checks. */
    if (additional && turing) {
        if (turing.isNsfw && !additional.nsfw) flagged = true;
    
        if (turing.isCP || (turing.isYoung && additional.nsfw)) {
            blocked = true;
            flagged = true;
        }
    }

    /* Final moderation result */
    const data: ModerationResult = {
        source,
        auto: auto ?? undefined,

        flagged: flagged,
        blocked: blocked
    };

    /* If the message was flagged, send the notice message to the user. */
    if (blocked && message && (reply ?? true)) {
        /* Reply to the invocation message. */
        await message.reply({
            embeds: [
                new EmbedBuilder()
                    .setTitle("What's this? 🤨")
                    .setDescription(`Your message may violate our **usage policies**. *If you continue to violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.`)
                    .setColor("Orange")
            ]
        }).catch(() => {});
    }

    /* If the message was flagged or blocked, try to translate the original flagged message into English. */
    if (flagged || blocked) {
        const translation = await translate(content, {
            to: "en"
        }).catch(() => null);

        /* Add the translation result. */
        if (translation !== null && translation.from.language.iso !== "en") data.translation = {
            content: translation.text,
            detected: translation.from.language.iso
        }
    }

    /* Send the moderation message to the private channel. */
    if (flagged || blocked) await sendModerationMessage({
        content, conversation, db,

        type: source,
        result: data
    });

    /* Add a flag to the user too, for reference. */
    if (flagged) await conversation.manager.bot.db.users.flag(db.user, { flagged: data.flagged, blocked: data.blocked, source: source, reference: content, translation: data.translation, auto: data.auto, data: data.data, highest: data.highest });

    /* If the moderation filter requested it, ban the user. */
    if (auto !== null && auto.type === "ban") {
        await conversation.manager.bot.db.users.ban(db.user, { status: true, automatic: true, reason: auto.reason });

    /* If the moderation filter requested it, give a warning to the user. */
    } else if (auto !== null && auto.type === "warn") {
        await conversation.manager.bot.db.users.warn(db.user, { automatic: true, reason: auto.reason });
    }

    return data;
}

export const checkImagePrompt = async ({ conversation, db, content, nsfw, model }: ImagePromptModerationOptions): Promise<ModerationResult | null> => {
    let result = await check({
        conversation, db, content,
        source: "image",

        /* Check for all possibly flags, *expect* for `sexual` flags to give people some freedom with their stupid prompts. */ 
        filter: nsfw ? (action) => {
            if (action && action.description === "Block sexual words") return true;
            return false;
        } : undefined,

        additional: { model, nsfw }
    });

    return result;
}

export const checkVideoPrompt = async ({ conversation, db, content }: DescribeModerationOptions): Promise<ModerationResult | null> => {
    return check({
        conversation, db, content, source: "video"
    });
}

export const checkTranslationPrompt = async ({ conversation, db, content, source }: TranslationModerationOptions): Promise<ModerationResult | null> => {
    return check({
        conversation, db, content, source
    });
}

export const checkDescribeResult = async ({ conversation, db, content }: DescribeModerationOptions): Promise<ModerationResult | null> => {
    return check({
        conversation, db, content, source: "describe"
    });
}