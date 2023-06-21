import { SlashCommandBuilder } from "discord.js";

import { Command, CommandResponse } from "../command/command.js";
import { MaxImagePromptLength } from "./imagine.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export default class DallECommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("dall-e")
			.setDescription("Deprecated command; use /imagine or /mj instead")

			.addStringOption(builder => builder
				.setName("prompt")
				.setDescription("Deprecated command; use /imagine or /mj instead")
				.setMaxLength(MaxImagePromptLength)
				.setRequired(false)
			)
		);
	}

    public async run(): CommandResponse {
		return new Response()
			.addEmbed(builder => builder
				.setTitle("This command is being deprecated 🧹")
				.setDescription(`\`/dall-e\` used an outdated & worse model for image generation, compared to \`/mj\` and \`/imagine\`. \`/mj\` offers **beautiful & free** image generation; \`/imagine\` gives you access to **lots of models** & customizablity for **free**.`)
				.setColor("Orange")
			)
			.setEphemeral(true);
    }
}