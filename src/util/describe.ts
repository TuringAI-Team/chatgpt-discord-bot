import { Attachment, MessageContextMenuCommandInteraction, ChatInputCommandInteraction } from "discord.js";
import chalk from "chalk";

import { ALLOWED_FILE_EXTENSIONS, ChatImageType } from "../chat/types/image.js";
import { LoadingResponse } from "../command/response/loading.js";
import { Conversation } from "../conversation/conversation.js";
import { NoticeResponse } from "../command/response/notice.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "./utils.js";

export interface DescribeAttachment {
    /* Type of the attachment */
    type: ChatImageType;

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
        const extension: string = Utils.fileExtension(chosen.url);

        /* Make sure that the uploaded attachment is allowed. */
        if (ALLOWED_FILE_EXTENSIONS.includes(extension)) attachment = { url: chosen.proxyURL, type: "image" };

    } else if (interaction instanceof MessageContextMenuCommandInteraction) {
        const results = await conversation.manager.session.client.findMessageImageAttachments(interaction.targetMessage);
        if (results.length > 0) attachment = results[0];
    }

    /* If no usable attachments could be found, show a notice message. */
    if (!attachment) return void await new NoticeResponse({
        message: `The message doesn't contain any usable attachments ❌\n\`/describe\` only supports the following files » ${ALLOWED_FILE_EXTENSIONS.map(ext => `\`.${ext}\``).join(", ")}`,
        color: "Red"
    }).send(interaction);

    await new LoadingResponse({
        phrases: [
            "Looking at the image",
            "Inspecting your image",
            "Looking at the details"
        ]
    }).send(interaction);

    /* Make sure that the image is accessible. */
    const accessible: boolean = await conversation.manager.bot.db.description.accessible(attachment);

    if (!accessible) return void await new NoticeResponse({
        message: "**Failed to download the provided attachment**; make sure that it is accessible ❌",
        color: "Red"
    }).send(interaction);

    try {
        /* Analyze & describe the image. */
        const description = await conversation.manager.bot.db.description.describe({
            input: attachment
        });

        if (conversation.manager.bot.dev) conversation.manager.bot.logger.debug(
            `User ${chalk.bold(interaction.user.tag)} described ${attachment.type} ${chalk.bold(attachment.url)} within ${chalk.bold(description.duration)}ms.`
        );

        const moderation = await conversation.manager.bot.moderation.check({
            db, user: interaction.user, content: description.result.description, source: "describe"
        });

        if (moderation.blocked) return void await conversation.manager.bot.moderation.message({
            result: moderation, original: interaction, name: "The image description"
        });

        await conversation.manager.bot.db.users.incrementInteractions(db, "image_descriptions");
        await conversation.manager.bot.db.plan.expenseForImageDescription(db, description);

        await new Response()
            .addEmbed(builder => builder
                .setTitle("Described image 🔎")
                .setDescription(description.result.description)
                .setImage(attachment.url)
                .setFooter(!description.cached ? { text: `${(description.duration / 1000).toFixed(1)}s` } : null)
                .setColor("Aqua")
            )
        .send(interaction);

    } catch (error) {
        await conversation.manager.bot.error.handle({
            title: "Failed to describe image", notice: "Something went wrong while trying to describe the provided image.", original: interaction, error
        });
    }
}