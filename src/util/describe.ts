import { Attachment, MessageContextMenuCommandInteraction, ChatInputCommandInteraction, Message, Embed, ContextMenuCommandInteraction, StickerFormatType, Sticker } from "discord.js";
import chalk from "chalk";

import { Conversation } from "../conversation/conversation.js";
import { NoticeResponse } from "../command/response/notice.js";
import { Response } from "../command/response.js";
import { Utils } from "./utils.js";
import { ModerationResult, checkDescribeResult, checkTranslationPrompt } from "../conversation/moderation/moderation.js";
import { DatabaseInfo } from "../db/managers/user.js";


const HAS_EMOJI_REGEX = /<a?:.+:\d+>/gm
const NORMAL_EMOJI_REGEX = /<:.+:(\d+)>/gm
const ANIMATED_EMOJI_REGEX = /<a:.+:(\d+)>/gm

const ALLOWED_FILE_EXTENSIONS: string[] = [ "webp", "png", "jpeg", "jpg", "gif" ]

interface DescribeAttachment {
    /* Type of the attachment */
    type: "sticker" | "image" | "emoji";

    /* Name of the attachment */
    name?: string;

    /* URL to the image file */
    url: string;
}

/**
 * Run the describe action dynamically, context menu or command.
 * 
 * @param conversation Conversation instance of the user
 * @param interaction Interaction, either context menu or command type
 */
export const runDescribeAction = async (conversation: Conversation, db: DatabaseInfo, interaction: ChatInputCommandInteraction | MessageContextMenuCommandInteraction): Promise<void> => {
    /* The attachment to use for the describe action */
    let attachment: DescribeAttachment = null!;

    if (interaction instanceof ChatInputCommandInteraction) {
        const chosen: Attachment = interaction.options.getAttachment("image", true);
        attachment = { url: chosen.proxyURL, type: "image" };

    } else if (interaction instanceof ContextMenuCommandInteraction) {
        const message: Message = interaction.targetMessage;

        const attachments: Attachment[] = Array.from(message.attachments.filter(a => {
            const suffix: string = a.name.split(".").pop()!;
            return ALLOWED_FILE_EXTENSIONS.includes(suffix);
        }).values());

        /* If no attachments were directly attached to the image, try searching for ones in the embeds. */
        if (attachments.length === 0) {
            /* Find all usable embeds. */
            const embeds: Embed[] = message.embeds.filter(e => (e.image && e.image.url) || (e.data.type === "image" && e.data.url));

            /* If there are also no usable embeds, try searching for usable stickers instead. */
            if (embeds.length === 0) {
                /* Find all usable stickers. */
                const stickers: Sticker[] = Array.from(
                    (message.stickers ?? []).filter(s => s.format !== StickerFormatType.Lottie).values()
                );

                /* If there are also no usable stickers, try searching for usable custom emojis instead. */
                if (stickers.length === 0) {
                    /* Find all usable emojis, animated or normal. */
                    if (!message.content.match(HAS_EMOJI_REGEX)) attachment = null!;
                    else {
                        const matches = NORMAL_EMOJI_REGEX.exec(message.content) ?? ANIMATED_EMOJI_REGEX.exec(message.content)!;
                        const type = message.content.includes("<a:") ? "gif" : "png";

                        if (matches === null) attachment = null!;
                        else attachment = { url: `https://cdn.discordapp.com/emojis/${matches[1]}.${type}?v=1`, type: "emoji" };
                    }
                    
                } else {
                    const chosen: Sticker = stickers[0];
                    attachment = { url: chosen.url, type: "sticker", name: chosen.name };
                }

            } else {
                const chosen: Embed = embeds[0];
                attachment = { url: chosen.image ? chosen.image.url : chosen.data.url!, type: "image" };
            }
        
        /* Otherwise, use the fitting attachment. */
        } else {
            const chosen: Attachment = attachments[0];
            attachment = { url: chosen.proxyURL, type: "image" };
        }
    }

    /* If no usable attachments could be found, show a notice message. */
    if (!attachment) return void await new NoticeResponse({
        message: `The message doesn't contain any usable attachments ❌\n\`/describe\` only supports the following files » ${ALLOWED_FILE_EXTENSIONS.map(ext => `\`.${ext}\``).join(", ")}`,
        color: "Red"
    }).send(interaction);

    /* List of random phrases to display while translating the message */
    const randomPhrases: string[] = [
        "Stealing your job",
        "Looking at the image",
        "Inspecting your image",
        "Looking at the details"
    ];

    await new Response()
        .addEmbed(builder => builder
            .setTitle(`${Utils.random(randomPhrases)} **...** 🤖`)
            .setColor("Aqua")
        )
    .send(interaction);

    /* Make sure that the image is accessible. */
    const response = await fetch(attachment.url, {
        method: "HEAD"
    });

    if (response.status !== 200) return void await new NoticeResponse({
        message: "**Failed to download the provided attachment**; make sure that it is accessible ❌",
        color: "Red"
    }).send(interaction);

    try {
        /* Get the interrogation model. */
        const model = await conversation.manager.bot.replicate.api.models.get("andreasjansson", "blip-2");
        const start: number = Date.now();
        
        /* Run the interrogation request, R.I.P money. */
        const result: string = (await conversation.manager.bot.replicate.api.run(`andreasjansson/blip-2:${model.latest_version!.id}`, {
            input: {
                image: attachment.url,

                caption: false,
                question: "What does this image show? Describe in detail.",
                context: "",
                use_nucleus_sampling: true,
                temperature: 1
            },

            wait: {
                interval: 750
            }
        })) as unknown as string;

        const duration: number = Date.now() - start;

        conversation.manager.bot.logger.debug(
            `User ${chalk.bold(interaction.user.tag)} described ${attachment.type} ${chalk.bold(attachment.url)} within ${chalk.bold(duration)}ms.`
        );

        const moderation: ModerationResult | null = await checkDescribeResult({
            conversation, db, content: result
        });

        if (moderation !== null && moderation.blocked) return void await new Response()
            .addEmbed(builder => builder
                .setTitle("What's this? 🤨")
                .setDescription(`The image description violates our **usage policies**.\n\n*If you violate the usage policies, we may have to take moderative actions; otherwise, you can ignore this notice*.`)
                .setColor("Orange")
            )
        .send(interaction);

        await conversation.manager.bot.db.users.incrementInteractions(db.user, "image_descriptions");

        await new Response()
            .addEmbed(builder => builder
                .setTitle("Described image 🔎")
                .setDescription(result)
                .setImage(attachment.url)
                .setFooter({ text: `${(duration / 1000).toFixed(1)}s` })
                .setColor("Aqua")
            )
        .send(interaction);

    } catch (error) {
        if (response.status !== 200) return void await new NoticeResponse({
            message: "Something went wrong while trying to describe the provided image.\n*The developers have been notified*.",
            color: "Red"
        }).send(interaction);
    }
}