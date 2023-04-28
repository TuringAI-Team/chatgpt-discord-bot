import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response, ResponseType } from "../command/response.js";
import { introductionButtons } from "../util/introduction.js";
import { Bot } from "../bot/bot.js";

export default class StatisticsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("bot")
                .setDescription("View information & statistics about the bot")
		, { always: true });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		const fields = [
			{
				key: "Servers 🖥️",
				value: this.bot.statistics.guildCount
			},

			{
				key: "Latency 🏓",
				value: `**\`${this.bot.statistics.discordPing.toFixed(1)}\`** ms`
			},

			{
				key: interaction.guild !== null ? "Cluster & Shard 💎" : "Cluster 💎",
				value: interaction.guild !== null ? `\`${this.bot.data.id + 1}\`/\`${this.bot.client.cluster.count}\` — \`${interaction.guild.shardId}\`` : `\`${this.bot.data.id + 1}\`/\`${this.bot.client.cluster.count}\``
			},

			{
				key: "Users 🫂",
				value: `${this.bot.statistics.discordUsers} <:discord:1097815072602067016> — ${this.bot.statistics.databaseUsers} <:chatgpt_blurple:1081530335306727545>`
			},

			{
				key: "Conversations 💬",
				value: this.bot.statistics.conversations
			},

			{
				key: "RAM 🖨️",
				value: `**\`${(this.bot.statistics.memoryUsage / 1024 / 1024).toFixed(2)}\`** MB`
			}
		];

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Bot Statistics")
			.setDescription(`The ultimate AI-powered Discord bot 🚀`)
			.setColor(this.bot.branding.color)

			.addFields(fields.map(({ key, value }) => ({
				name: key, value: value.toString(),
				inline: true
			})));

        return new Response()
            .addEmbed(builder)
			.addComponent(ActionRowBuilder<ButtonBuilder>, introductionButtons(this.bot));
    }
}