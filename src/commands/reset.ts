import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Conversation } from "../conversation/conversation.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export default class ResetCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("reset")
                .setDescription("Reset your conversation with the bot")
		);
    }

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Get the user's conversation. */
		const conversation: Conversation | null = this.bot.conversation.get(interaction.user);

		if (conversation === null || !conversation.previous) return new Response()
			.addEmbed(builder => builder
				.setDescription("You do not have an active conversation 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		/* If the conversation is currently busy, don't reset it. */
		if (conversation.generating) return new Response()
			.addEmbed(builder => builder
				.setDescription("You have a request running in your conversation, *wait for it to finish* 😔")
				.setColor("Red")
			)
			.setEphemeral(true);

		try {
			/* Try to reset the conversation. */
			await conversation.reset(db.user, false);
			await this.bot.db.users.incrementInteractions(db, "resets");

			return new Response()
				.addEmbed(builder => builder
					.setDescription("Your conversation has been reset 😊")
					.setColor("Green")
				)
				.setEphemeral(true);

		} catch (error) {
			await this.bot.moderation.error({
				title: "Failed to reset the conversation", error: error
			});

			return new Response()
				.addEmbed(builder =>
					builder.setTitle("Failed to reset your conversation ⚠️")
						.setDescription(`*The developers have been notified.*`)
						.setColor("Red")
				);
		}
    }
}