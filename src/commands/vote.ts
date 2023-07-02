import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { ConversationCooldownModifier, ConversationDefaultCooldown } from "../conversation/conversation.js";
import { Command, CommandResponse } from "../command/command.js";
import { Cooldown } from "../conversation/utils/cooldown.js";
import { DatabaseInfo } from "../db/managers/user.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export default class VoteCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("vote")
                .setDescription("Vote for our bot & get rewards")
		);
    }

    public async run(_: any, db: DatabaseInfo): CommandResponse {
		const fields = [
			{
				key: "Way lower cool-down ⏰",
				value: `The cool-down between messages can get a bit annoying. By voting, it'll be reduced to only **${Math.round(Cooldown.calculate(ConversationDefaultCooldown.time, ConversationCooldownModifier.voter) / 1000)}** seconds.`
			},

			{
				key: "Support our bot 🙏",
				value: "If you vote, you'll help us grow even further, and give people access to **ChatGPT** and other language models for completely free."
			}
		];

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Vote for our bot <:topgg:1119699678343200879>")
			.setDescription(`*By voting for **${this.bot.client.user.username}**, you'll get the following rewards as long as you vote*.`)
			.setColor("#FF3366")

			.addFields(fields.map(({ key, value }) => ({
				name: key, value: value.toString()
			})));

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId("general:vote")
					.setEmoji("🎉")
					.setLabel("Check your vote")
					.setStyle(ButtonStyle.Success),

				new ButtonBuilder()
					.setURL(this.bot.vote.link(db))
					.setEmoji("<:topgg:1119699678343200879>")
					.setLabel("top.gg")
					.setStyle(ButtonStyle.Link)
			);

        return new Response()
            .addEmbed(builder)
			.addComponent(ActionRowBuilder<ButtonBuilder>, row)
			.setEphemeral(true);
    }
}