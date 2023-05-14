import { SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { Response } from "../../command/response.js";
import { Bot } from "../../bot/bot.js";

export default class CampaignsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
				.setName("campaigns")
				.setDescription("View & manage ad campaigns")
        , { restriction: [ "advertiser", "investor", "owner" ] });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		return new Response()
			.setContent("To be done");
    }
}