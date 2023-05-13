import { Interaction, ChatInputCommandInteraction, ButtonInteraction, AutocompleteInteraction } from "discord.js";

import { handleModerationInteraction } from "../util/moderation/moderation.js";
import { handleIntroductionPageSwitch } from "../util/introduction.js";
import { handleError } from "../util/moderation/error.js";
import MetricsCommand from "../commands/dev/metrics.js";
import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class InteractionCreateEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "interactionCreate");
	}

	public async run(interaction: Interaction): Promise<void> {
		try {
			if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.customId.startsWith("settings:")) {
				if (!interaction || !interaction.customId) return;
				return await this.bot.db.settings.handleInteraction(interaction);
			}

			if (interaction.isButton() && interaction.customId.startsWith("metrics:")) {
				if (!interaction || !interaction.customId) return;
				return await this.bot.command.get<MetricsCommand>("metrics").handleInteraction(interaction);
			}

			if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
				await this.bot.command.handleCommand(interaction as ChatInputCommandInteraction);

			} else if (interaction.isAutocomplete()) {
				await this.bot.command.handleCompletion(interaction as AutocompleteInteraction);

			} else if (interaction.isStringSelectMenu()) {
				await handleIntroductionPageSwitch(this.bot, interaction);
				await handleModerationInteraction(this.bot, interaction);

			} else if (interaction.isButton()) {
				await this.bot.conversation.generator.handleButtonInteraction(interaction as ButtonInteraction);
				await handleModerationInteraction(this.bot, interaction);
			}

		} catch (error) {
			await handleError(this.bot, { error: error as Error, reply: false, title: "Failed to process interaction" });
		}
	}
}