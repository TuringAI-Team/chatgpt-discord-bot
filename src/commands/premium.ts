import { ChatInputCommandInteraction, GuildMember, SlashCommandBuilder } from "discord.js";

import { Command, CommandResponse } from "../command/command.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { PremiumRole } from "../util/roles.js";
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