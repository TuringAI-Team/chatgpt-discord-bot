import { Attachment, MessageContextMenuCommandInteraction, ChatInputCommandInteraction } from "discord.js";
import chalk from "chalk";

import { ModerationResult, checkDescribeResult } from "../conversation/moderation/moderation.js";
import { ALLOWED_FILE_EXTENSIONS, ChatImageType } from "../chat/types/image.js";
import { LoadingResponse } from "../command/response/loading.js";
import { Conversation } from "../conversation/conversation.js";
import { NoticeResponse } from "../command/response/notice.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";

interface DescribeAttachment {
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
        attachment = { url: chosen.proxyURL, type: "image" };

    } else if (interaction instanceof MessageContextMenuCommandInteraction) {
        const results = conversation.session.client.findMessageImageAttachments(interaction.targetMessage);
        if (results.length > 0) attachment = results[0];
    }

    /* If no usable attachments could be found, show a notice message. */
    if (!attachment) return void await new NoticeResponse({
        message: `The message doesn't contain any usable attachments ❌\n\`/describe\` only supports the following files » ${ALLOWED_FILE_EXTENSIONS.map(ext => `\`.${ext}\``).join(", ")}`,
        color: "Red"
    }).send(interaction);

    new LoadingResponse({
        phrases: [
            "Looking at the image",
            "Inspecting your image",
            "Looking at the details"
        ]
    }).send(interaction);

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

        if (conversation.manager.bot.dev) conversation.manager.bot.logger.debug(
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