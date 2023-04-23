import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Conversation } from "../conversation/conversation.js";
import { handleError } from "../util/moderation/error.js";
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

    public async run(interaction: CommandInteraction, { user }: DatabaseInfo): CommandResponse {
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
			await conversation.reset(false);
			await this.bot.db.users.incrementInteractions(user, "resets");

			return new Response()
				.addEmbed(builder => builder
					.setDescription("Your conversation has been reset 😊")
					.setColor("Green")
				)
				.setEphemeral(true);

		} catch (error) {
			await handleError(this.bot, {
				title: "Failed to reset the conversation",
				message: await interaction.fetchReply().catch(() => undefined),
				error: error as Error,
				reply: false
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