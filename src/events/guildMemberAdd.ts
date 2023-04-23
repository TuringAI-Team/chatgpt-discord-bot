import { GuildMember } from "discord.js";

import { PremiumRole } from "../util/roles.js";
import { Event } from "../event/event.js";
import { Bot } from "../bot/bot.js";

export default class GuildMemberAddEvent extends Event {
	constructor(bot: Bot) {
		super(bot, "guildMemberAdd");
	}

	public async run(member: GuildMember): Promise<void> {
		if (member.guild && member.guild.id === this.bot.app.config.channels.moderation.guild) {
			await PremiumRole.checkRole(this.bot, member);
		}
	}
}