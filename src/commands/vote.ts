import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { CONVERSATION_COOLDOWN_MODIFIER, CONVERSATION_DEFAULT_COOLDOWN } from "../conversation/conversation.js";
import { Command, CommandResponse } from "../command/command.js";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export default class VoteCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("vote")
                .setDescription("Vote for our bot & get rewards")
		, { long: true, cooldown: 15 * 1000 });
    }

    public async run(): CommandResponse {
		const fields = [
			{
				key: "Way lower cool-down ⏰",
				value: `The cool-down between messages can get a bit annoying. By voting, it'll be reduced to only **${Math.round((CONVERSATION_DEFAULT_COOLDOWN.time! * CONVERSATION_COOLDOWN_MODIFIER.Voter) / 1000)}** seconds.`
			},

			{
				key: "Support our bot 🙏",
				value: "If you vote, you'll help us grow even further, and give people access to **ChatGPT** and other language models for completely free."
			}
		];

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Vote for our bot 📩")
			.setDescription(`*By voting for **${this.bot.client.user!.username}**, you'll get the following rewards, for as long as you vote*.`)
			.setColor(this.bot.branding.color)

			.addFields(fields.map(({ key, value }) => ({
				name: key, value: value.toString()
			})));

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
				new ButtonBuilder()
					.setCustomId("check-vote:-1")
					.setEmoji("🎉")
					.setLabel("Check your vote")
					.setStyle(ButtonStyle.Success),

				new ButtonBuilder()
					.setURL(`https://top.gg/en/bot/${this.bot.client.user!.id}/vote`)
					.setLabel("Vote")
					.setStyle(ButtonStyle.Link)
			);

        return new Response()
            .addEmbed(builder)
			.addComponent(ActionRowBuilder<ButtonBuilder>, row);
    }
}