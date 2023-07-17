import { ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, SlashCommandBuilder } from "discord.js";

import { InteractionHandlerResponse, InteractionHandlerRunOptions } from "../interaction/handler.js";
import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { APIInteractionHandlerData } from "../interactions/api.js";
import { ErrorResponse } from "../command/response/error.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class APICommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("api").setDescription("...")

				.addSubcommand(builder => builder
					.setName("overview").setDescription("View all of your expenses & how to use the API")
				)

				.addSubcommand(builder => builder
					.setName("keys").setDescription("Manage your API keys")
				)
		, {
			restriction: [ "api", "owner" ]
		});
    }

	public async handleInteraction({ data, raw }: InteractionHandlerRunOptions<ButtonInteraction, APIInteractionHandlerData>): InteractionHandlerResponse {
		return new Response().setContent(raw.join(":"));
	}

    public async run(interaction: CommandInteraction, db: DatabaseInfo): CommandResponse {
		/* Which action to perform */
		const action: "overview" | "keys" = interaction.options.getSubcommand(true) as any;

		if (action === "overview") {
			const plan = this.bot.db.plan.get(db.user);

			if (plan !== null) return new ErrorResponse({
				message: "You do not have enough **Pay-as-you-go 📊** credits to use the API; *purchase some below*.", color: "Orange", emoji: null
			}).addComponent(ActionRowBuilder<ButtonBuilder>, new ActionRowBuilder<ButtonBuilder>()
				.addComponents(new ButtonBuilder()
					.setStyle(ButtonStyle.Link)
					.setURL(Utils.shopURL())
					.setLabel("Visit our shop")
					.setEmoji("💸")
				)
			);
		}
    }
}