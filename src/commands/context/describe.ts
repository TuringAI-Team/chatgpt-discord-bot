import { ContextMenuCommandBuilder, MessageContextMenuCommandInteraction } from "discord.js";

import { ContextMenuCommand } from "../../command/types/context.js";
import { NoticeResponse } from "../../command/response/notice.js";
import { Conversation } from "../../conversation/conversation.js";
import { CommandResponse } from "../../command/command.js";
import { runDescribeAction } from "../../util/describe.js";
import { DatabaseInfo } from "../../db/managers/user.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

export default class DescribeImageContextMenuCommand extends ContextMenuCommand {
	constructor(bot: Bot) {
		super(bot, new ContextMenuCommandBuilder()
			.setName("Describe image")
        , {
            cooldown: {
                Free: 3 * 60 * 1000,
                Voter: 2 * 60 * 1000,
                GuildPremium: 45 * 1000,
                UserPremium: 30 * 1000
            }
        });
	}

    public async run(interaction: MessageContextMenuCommandInteraction, db: DatabaseInfo): CommandResponse {
        /* The user's conversation */
        const conversation: Conversation = await this.bot.conversation.create(interaction.user);

        if (conversation.generating) return new NoticeResponse({
			message: "You have a request running in your conversation, *wait for it to finish* 😔",
			color: "Red"
		});

        if (conversation.cooldown.active) return new Response()
            .addEmbeds(conversation.cooldownMessage(db))
            .setEphemeral(true);

        await runDescribeAction(conversation, db, interaction as any);
    }
}