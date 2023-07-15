import { CommandInteraction, ContextMenuCommandInteraction, Message } from "discord.js";

import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js";
import { GPTTranslationError, GPTTranslationErrorType } from "../error/translation.js";
import { LanguageManager, UserLanguage, UserLanguages } from "../db/types/locale.js";
import { OpenAIChatMessage } from "../turing/types/openai/chat.js";
import { LoadingResponse } from "../command/response/loading.js";
import { CommandSpecificCooldown } from "../command/command.js";
import { NoticeResponse } from "../command/response/notice.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";
import { Utils } from "./utils.js";

export interface TranslationOptions {
    target?: UserLanguage;
    content: string;
}

export interface TranslationCommandOptions {
    db: DatabaseInfo;
    content: string;
    interaction: CommandInteraction | ContextMenuCommandInteraction;
    language?: UserLanguage;
    original?: Message;
}

export interface RawTranslationData {
    /* The translated content */
    content: string;

    /* The input language */
    input: string;

    /* An error that occurred, if applicable */
    error?: string;
}

export type TranslationResult = RawTranslationData & {
    target: UserLanguage;
    tokens: Record<"prompt" | "completion", number>;
}

export const TranslationCooldown: CommandSpecificCooldown = {
    free: 3 * 60 * 1000,
    voter: 2.5 * 60 * 1000,
    subscription: 30 * 1000
}

export class TranslationManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    /* ChatGPT prompt used to translate the given input text */
    private generatePrompt({ content }: TranslationOptions, language: UserLanguage): OpenAIChatMessage[] {
        return [
            {
                role: "system",
                content: `
    Your task is to translate the given input text by the user and guess the input language too. Follow all instructions closely.
    
    Structure the single-line minified JSON object like this:
    "content": Translation of the input message into the language. Make sure to translate it correctly & well, keep the meaning, slang, slurs & typos all the same, just translate it all into ${language}. Keep the same writing style consistently.
    "input": Display name of the detected input language (guess it from the input, e.g. "English", "German", "Russian", "Base64", "Hex", etc.)
    
    Errors that may occur:
    "Couldn't detect message language": input is invalid, not known language
    "Does not need to be translated": the message is already the target language (${language.modelName ?? language.name})
    
    Otherwise, if you think any of the above errors apply to the message, add ONLY this property to the minified JSON object and ignore above properties:
    "error": The error that occurred, one of the above
    
    You must translate the given text by the user to the language "${language.modelName ?? language.name}". You can translate various arbitrary languages too, e.g. Pig Latin, Base64, Hex, Leetspeak, Reversed, and even more.
    The user will now give you a message to translate, your goal is to apply the above rules and output a minified JSON object on a single line, without additional explanations or text.
                `.trim()
            },

            {
                content: `"""\n${content}\n"""`,
                role: "assistant"
            }
        ]
    }

    public async translate(options: TranslationOptions): Promise<TranslationResult> {
        /* How many tokens to use for the generation */
        const maxTokens: number = 500;

        /* Target language to translate to */
        const target: UserLanguage = options.target ?? UserLanguages[0];

        /* Messages to pass to ChatGPT */
        const messages: OpenAIChatMessage[] = this.generatePrompt(options, target);

        const tokens = {
            prompt: countChatMessageTokens(messages),
            completion: 0
        };

        if (tokens.prompt + maxTokens > 4097) throw new GPTTranslationError({
            type: GPTTranslationErrorType.TooLong
        });

        /* Generate the translation result using ChatGPT. */
        const raw = await this.bot.turing.openAI({
            messages, model: "gpt-3.5-turbo",
            max_tokens: maxTokens, temperature: 0.1
        });

        tokens.completion = getPromptLength(raw.result);

        let data: RawTranslationData | null = (content => {
            try {
                const result: RawTranslationData = JSON.parse(content);
                return result;

            } catch (error) {}
            return null;
        })(raw.result);

        if (data && data.error) throw new GPTTranslationError({
            type: GPTTranslationErrorType.Failed, data
        });

        if (!data || !data.content || !data.input || data.content === "null") throw new GPTTranslationError({
            type: GPTTranslationErrorType.Failed
        });

        return {
            ...data, target, tokens
        };
    }

    public async run({ content, interaction, db, original, language }: TranslationCommandOptions): Promise<Response> {
        /* Target language to translate to */
        const target: UserLanguage = language ?? LanguageManager.get(this.bot, db.user);

        /* Cleaned content to translate */
        content = Utils.cleanContent(this.bot, content);

        if (content.length === 0) return new NoticeResponse({
			message: "The selected message doesn't contain any content ❌",
			color: "Red"
		});

        /* Defer the reply, as this might take a while. */
        await interaction.deferReply().catch(() => {});

        let moderation = await this.bot.moderation.check({
            db, user: interaction.user, content, source: "translationPrompt"
        });

        if (moderation.blocked) return await this.bot.moderation.message({
            result: moderation, name: "The message to translate"
        });

        new LoadingResponse({
            phrases: [
                `Translating into ${target.name}`,
                "Translating the message"
            ],

            bot: this.bot, db
        }).send(interaction);

        try {
            const result = await this.translate({
                content, target
            });

            moderation = await this.bot.moderation.check({
                db, user: interaction.user, content, source: "translationResult"
            });
    
            if (moderation.blocked) return await this.bot.moderation.message({
                result: moderation, name: "The translated message"
            });
    
            await this.bot.db.users.incrementInteractions(db, "translations");
            await this.bot.db.plan.expenseForTranslation(db, result.tokens, result.input);
    
            const response = new Response()
                .addEmbed(builder => builder
                    .setTitle("Translated message 🌐")
                    .setDescription(`\`\`\`\n${result.content}\n\`\`\``)
                    .setColor(this.bot.branding.color)
                    .addFields([
                        {
                            name: "Detected language",
                            value: result.input,
                            inline: true
                        },
    
                        {
                            name: "Translated into",
                            value: target.name,
                            inline: true
                        }
                    ])
                );

            if (original) response.addEmbed(builder => builder
                .setDescription(content)
                .setAuthor({ name: original.author.username, iconURL: original.author.displayAvatarURL() })
                .setTitle("Jump to message")
                .setURL(original.url)
            );
            else response.addEmbed(builder => builder
                .setTitle("Original message")
                .setDescription(content)
            );

            return response;

        } catch (err) {
            const prefix: string = original ? `**[This message](${original.url})**` : "The message";

            if (err instanceof GPTTranslationError) {
                if (err.options.data.type === GPTTranslationErrorType.TooLong) return new NoticeResponse({
                    message: `${prefix} is **too long** to be translated 😔`,
                    color: "Red"
                });

                if (err.options.data.type === GPTTranslationErrorType.SameContent) return new NoticeResponse({
                    message: `${prefix} does not need to be translated 😔`,
                    color: "Red"
                });

                if (err.options.data.type === GPTTranslationErrorType.Failed) {
                    return new NoticeResponse({
                        message: `${prefix} could not be translated${err.error ? `: **${err.error}**` : ""} 😔`,
                        color: "Red"
                    });
                }
            }

			return await this.bot.error.handle({
				title: "Failed to translate", notice: "Something went wrong while trying to translate the message.", error: err
			});
        }
    }
}