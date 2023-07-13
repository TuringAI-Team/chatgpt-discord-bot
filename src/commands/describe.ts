import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
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
                voter: 2 * 60 * 1000,
                subscription: 30 * 1000
            },

            synchronous: true
		});
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		return this.bot.description.run(db, interaction);
    }
}