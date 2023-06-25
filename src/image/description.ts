import { APIEmbedField, Attachment, AttachmentBuilder, ChatInputCommandInteraction, MessageContextMenuCommandInteraction } from "discord.js";
import { Image, createCanvas } from "@napi-rs/canvas";
import crypto from "crypto";

import { ALLOWED_FILE_EXTENSIONS, ChatImageAttachment, ChatImageType, ImageBuffer } from "../chat/types/image.js";
import { countChatMessageTokens, getPromptLength } from "../conversation/utils/length.js";
import { LoadingResponse } from "../command/response/loading.js";
import { Conversation } from "../conversation/conversation.js";
import { NoticeResponse } from "../command/response/notice.js";
import { OpenAIChatMessage } from "../openai/types/chat.js";
import { ImageOCRResult, detectText } from "../util/ocr.js";
import { ClusterDatabaseManager } from "../db/cluster.js";
import { ChatBaseImage } from "../chat/types/image.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export interface ImageDescriptionResult {
    /* BLIP description of the image */
    description: string;

    /* Detected text in this image, if enabled & detected */
    ocr: ImageOCRResult | null;
}

export interface DescribeAttachment {
    /* Type of the attachment */
    type: ChatImageType;

    /* Name of the attachment */
    name?: string;

    /* URL to the image file */
    url: string;
}

export interface DescribeSummary {
    tokens: {
        prompt: number;
        completion: number;
    };

    content: string;
}

export interface DatabaseDescription {
    /* MD5 hash of the image */
    id: string;

    /* How long it took to describe the image */
    duration: number;

    /* When this image description was generated */
    when: string;

    /* Description of the image */
    result: ImageDescriptionResult;
}

export type ImageDescriptionInput = ChatImageAttachment | ChatBaseImage | DescribeAttachment

interface ImageDescriptionOptions {
    /* The input attachment to describe */
    input: ImageDescriptionInput;

    /* The buffer of the image, optional */
    buffer?: ImageBuffer;

    /* Whether a cached description can be used */
    cached?: boolean;
}

export class ImageDescriptionManager {
    private readonly bot: Bot;

    constructor(bot: Bot) {
        this.bot = bot;
    }

    private async get(input: ImageDescriptionInput & { hash: string }): Promise<DatabaseDescription | null> {
        return this.bot.db.fetchFromCacheOrDatabase(
            "descriptions", input.hash
        );
    }

    private async save(result: DatabaseDescription, buffer: ImageBuffer): Promise<void> {
        await this.bot.db.storage.uploadImageDescription(result, buffer).catch(() => {});
        await this.bot.db.users.updateImageDescription(result.id, result);
    }

    /**
     * Check whether an image attachment is accessible, by sending a HEAD request to the URL.
     * @param input Image attachment input
     * 
     * @returns Whether it is accessible
     */
    public async accessible(input: ImageDescriptionInput): Promise<boolean> {
        try {
            const response = await fetch(input.url, { method: "HEAD" });
            return response.status === 200;

        } catch (_) {
            return false;
        }
    }

    private async fetch(input: ImageDescriptionInput): Promise<ImageBuffer> {
        return (await Utils.fetchBuffer(input.url))!;
    }

    private hash(buffer: ImageBuffer): string {
        const hashStream = crypto.createHash("md5");

        hashStream.write(buffer.buffer);
        hashStream.end();

        const hash: string = hashStream.read().toString("hex");
        return hash;
    }

    public async describe(options: ImageDescriptionOptions): Promise<DatabaseDescription & { cached: boolean }> {
        let { input, cached, buffer }: Required<Omit<ImageDescriptionOptions, "buffer">> & { buffer: ImageBuffer | null } = {
            cached: options.cached ?? true,
            buffer: options.buffer ?? null,
            input: options.input
        };

        /* Buffer data of the described image */
        if (buffer === null) buffer = await this.fetch(input);
        const hash: string = this.hash(buffer);

        /* First, try to find a cached image description. */
        if (cached) {
            const entry: DatabaseDescription | null = await this.get({ ...input, hash });
            if (entry !== null) return { ...entry, cached: true };
        }

        /* Additionally, run OCR text recognition, to further improve results. */
        const ocr: ImageOCRResult | null = await detectText(this.bot, {
            url: input.url, engine: 2
        }).catch(() => null);

        /* Convert the image into a data URL. */
        const url: string = input.url;

        /* Run the interrogation request, R.I.P money. */
        const description = await this.bot.runpod.blip2({
            data_url: url
        });

        /* Final image description result */
        const result: DatabaseDescription = {
            id: hash, duration: description.duration, when: new Date().toISOString(),

            result: {
                ocr, description: description.output.captions[0].caption
            }
        };

        /* Add the image description result to the cache & database. */
        await this.save(result, buffer);

        return {
            ...result, cached: false
        };
    }

    public async run(conversation: Conversation, db: DatabaseInfo, interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction): Promise<Response> {
        /* The attachment to use for the describe action */
        let attachment: DescribeAttachment = null!;

        if (interaction instanceof ChatInputCommandInteraction) {
            const chosen: Attachment = interaction.options.getAttachment("image", true);
            const extension: string = Utils.fileExtension(chosen.url);

            /* Make sure that the uploaded attachment is allowed. */
            if (ALLOWED_FILE_EXTENSIONS.includes(extension)) attachment = { url: chosen.proxyURL, type: "image" };

        } else if (interaction instanceof MessageContextMenuCommandInteraction) {
            const results = await conversation.manager.session.client.findMessageImageAttachments(interaction.targetMessage);
            if (results.length > 0) attachment = results[0];
        }

        /* If no usable attachments could be found, show a notice message. */
        if (!attachment) return new NoticeResponse({
            message: `The message doesn't contain any usable attachments ❌\n\`/describe\` only supports the following file formats » ${ALLOWED_FILE_EXTENSIONS.map(ext => `\`.${ext}\``).join(", ")}`,
            color: "Red"
        });

        await new LoadingResponse({
            phrases: [
                "Looking at the image",
                "Inspecting your image",
                "Looking at the details"
            ],

            bot: this.bot, db
        }).send(interaction);

        /* Make sure that the image is accessible. */
        const accessible: boolean = await this.accessible(attachment);

        if (!accessible) return new NoticeResponse({
            message: "**Failed to download the provided attachment**; make sure that it is accessible ❌",
            color: "Red"
        });

        try {
            /* Buffer of the input image */
            const buffer: ImageBuffer = await this.fetch(attachment);

            /* Analyze & describe the image. */
            const description = await this.describe({
                input: attachment, buffer
            });

            const moderation = await this.bot.moderation.check({
                db, user: interaction.user, content: description.result.description, source: "describe"
            });

            if (moderation.blocked) return await this.bot.moderation.message({
                result: moderation, name: "The image description"
            });

            /* Draw the additional detected OCR text overlay. */
            const final: ImageBuffer = await this.drawTextOverlay(buffer, description.result.ocr);

            const fields: APIEmbedField[] = [];

            fields.push({
                name: "What is this?",
                value: description.result.description
            });

            if (description.result.ocr !== null) fields.push({
                name: "What does it say?",
                value: `\`\`\`\n${description.result.ocr.content}\n\`\`\``
            });

            /* Generate the ChatGPT-assisted description of the image. */
            const summary = description.result.ocr !== null ? await this.generateDescription(description) : null;

            if (summary !== null) fields.push({
                name: "Summary", value: summary.content
            });

            await this.bot.db.users.incrementInteractions(db, "imageDescriptions");
            await this.bot.db.plan.expenseForImageDescription(db, description, summary);

            return new Response()
                .addEmbed(builder => builder
                    .setTitle("Described image 🔎")
                    .setDescription(fields.map(field => `__**${field.name}**__\n${field.value}`).join("\n\n"))
                    .setImage(`attachment://image.png`)
                    .setFooter(!description.cached ? { text: `${(description.duration / 1000).toFixed(1)}s` } : null)
                    .setTimestamp(description.cached && description.when ? Date.parse(description.when) : null)
                    .setColor(this.bot.branding.color)
                )
                .addAttachment(
                    new AttachmentBuilder(final.buffer).setName("image.png")
                );

        } catch (error) {
            return await this.bot.error.handle({
                title: "Failed to describe image", notice: "Something went wrong while trying to describe the provided image.", error
            });
        }
    }

    private async generateDescription(result: DatabaseDescription): Promise<DescribeSummary | null> {
        /* The formatted prompt */
        const prompt = this.buildPrompt(result);

        try {
            /* Generate the summarization result using ChatGPT. */
            const raw = await this.bot.turing.openAI({
                messages: prompt.messages, model: "gpt-3.5-turbo",
                temperature: 0.75, maxTokens: 300
            });

            const content: string = raw.response.message.content;

            return {
                content,

                tokens: {
                    completion: getPromptLength(content),
                    prompt: prompt.tokens
                }
            };

        } catch (_) {
            return null;
        }
    }

    private buildPrompt(result: DatabaseDescription): { tokens: number; messages: OpenAIChatMessage[] } {
        const messages: OpenAIChatMessage[] = [];

        messages.push({
            content: `Your job is to guess what the given image shows, from the image description & detected text, if any. You will be given the image description (generated by another AI model) & optionnaly the detected text on the image using an OCR engine. Try to accurately guess what the image shows & means. Keep your response short & straight to the point, 1-3 sentences. Refer to the image as an actual image, not as image description or detected text. Prioritize the detected text above the image description, as it might be inacurrate or completely off. Do not say that you cannot view the image.`,
            role: "system"
        });

        messages.push({
            content: `Image description: """${result.result.description}"""${result.result.ocr !== null ? `\n\nDetected text: """${result.result.ocr.content}"""` : ""}`,
            role: "system"
        });

        return {
            messages, tokens: countChatMessageTokens(messages)
        };
    }

    private async drawTextOverlay(buffer: ImageBuffer, result: ImageOCRResult | null): Promise<ImageBuffer> {
        return this.drawOverlay(buffer, result, "rgba(255, 0, 0, 0.4)");
    }

    private async removeTextFromImage(buffer: ImageBuffer, result: ImageOCRResult | null): Promise<ImageBuffer> {
        return this.drawOverlay(buffer, result, "#ffffff");
    }

    private async drawOverlay(buffer: ImageBuffer, result: ImageOCRResult | null, style: string | CanvasGradient | CanvasPattern): Promise<ImageBuffer> {
        /* If there's nothing to draw, simply skip this step. */
        if (result === null) return buffer;

        const image: Image = new Image();
        image.src = buffer.buffer;

		const canvas = createCanvas(image.width, image.height);
		const context = canvas.getContext("2d");

        /* Draw the original image first. */
        context.drawImage(image, 0, 0);

        for (const line of result.lines) {
            for (const word of line.words) {
                /* Draw a box, where the word is on the image. */
                context.fillStyle = style;
                context.fillRect(word.left, word.top, word.width, word.height);
            }
        }

        return new ImageBuffer(
            await canvas.encode("png")
        );
    }
}