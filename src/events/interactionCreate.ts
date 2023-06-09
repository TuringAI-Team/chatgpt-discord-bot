import { Interaction, ChatInputCommandInteraction, AutocompleteInteraction } from "discord.js";

import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class InteractionCreateEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "interactionCreate");
	}

	public async run(interaction: Interaction): Promise<void> {
		if (!interaction || ((interaction.isButton() || interaction.isAnySelectMenu()) && !interaction.customId)) return;

		try {
			if (interaction.isChatInputCommand() || interaction.isMessageContextMenuCommand()) {
				await this.bot.command.handleCommand(interaction as ChatInputCommandInteraction);

			} else if (interaction.isStringSelectMenu() || interaction.isButton() || interaction.isModalSubmit()) {
				await this.bot.interaction.handleInteraction(interaction);
			}

		} catch (error) {
			await this.bot.error.handle({
				error, title: "Failed to process interaction"
			});
		}
	}
}