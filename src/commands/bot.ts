import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { introductionButtons } from "../util/introduction.js";
import { getInfo } from "discord-hybrid-sharding";
import { Response } from "../command/response.js";
import { Bot } from "../bot/bot.js";

export default class StatisticsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("bot")
                .setDescription("View information & statistics about the bot")
		, { always: true, waitForStart: true });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		const fields = [
			{
				key: "Servers 🖥️",
				value: this.bot.statistics.guildCount
			},

			{
				key: interaction.guild !== null ? "Cluster & Shard 💎" : "Cluster 💎",
				value: `\`${this.bot.data.id + 1}\`/\`${this.bot.client.cluster.count}\`${interaction.guild !== null ? `— \`${interaction.guild.shardId + 1}\`/\`${getInfo().TOTAL_SHARDS}\`` : ""}`
			},

			{
				key: "Latency 🏓",
				value: `**\`${this.bot.statistics.discordPing.toFixed(1)}\`** ms`
			},

			{
				key: "Users 🫂",
				value: `${this.bot.statistics.discordUsers} <:discord:1097815072602067016> — ${this.bot.statistics.databaseUsers} <:chatgpt_blurple:1081530335306727545>`
			},

			{
				key: "RAM 🖨️",
				value: `**\`${(this.bot.statistics.memoryUsage / 1024 / 1024).toFixed(2)}\`** MB`
			},

			{
				key: "Version 🔃",
				value: this.bot.statistics.commit !== null ? `[\`${this.bot.statistics.commit.hash.slice(undefined, 8)}\`](https://github.com/TuringAI-Team/chatgpt-discord-bot/commit/${this.bot.statistics.commit.hash})` : "❓"
			},
		];

		const builder: EmbedBuilder = new EmbedBuilder()
			.setTitle("Bot Statistics")
			.setDescription("*The ultimate AI-powered Discord bot*")
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