import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, GuildMember, SlashCommandBuilder } from "discord.js";

import { DatabaseInfo, UserSubscriptionType } from "../db/managers/user.js";
import { Command, CommandResponse } from "../command/command.js";
import { ErrorResponse } from "../command/response/error.js";
import { ProgressBar } from "../util/progressBar.js";
import { Response } from "../command/response.js";
import { PremiumRole } from "../util/roles.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class PremiumCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("premium")
                .setDescription("View information about Premium & your current subscription")
		);
    }

    public async run(interaction: ChatInputCommandInteraction, db: DatabaseInfo): CommandResponse {
		/* If the command was run on the support server, check whether the user already has their Premium role. */
		if (db.guild && db.guild.id === this.bot.app.config.channels.moderation.guild && interaction.member instanceof GuildMember) {
			await PremiumRole.checkRole(this.bot, interaction.member);
		}

		return await this.bot.db.plan.buildOverview(interaction, db);
    }
}