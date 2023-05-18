import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Conversation } from "../conversation/conversation.js";
import { runDescribeAction } from "../util/describe.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Bot } from "../bot/bot.js";

export default class DescribeCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("describe")
                .setDescription("Describe an image using AI")
				.addAttachmentOption(builder => builder
					.setName("image")
					.setDescription("Which image to describe")
					.setRequired(true)
				)
		, {
			cooldown: {
                free: 3 * 60 * 1000,
                voter: 1.75 * 60 * 1000,
                subscription: 30 * 1000
            }
		});
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		const conversation: Conversation = await this.bot.conversation.create(interaction.user);
		return void await runDescribeAction(conversation, db, interaction);
    }
}