import { ActionRowBuilder, ButtonBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { getInfo } from "discord-hybrid-sharding";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Introduction } from "../util/introduction.js";
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
				value: `${new Intl.NumberFormat("en-US").format(this.bot.statistics.guildCount)}`
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
				value: `${new Intl.NumberFormat("en-US").format(this.bot.statistics.discordUsers)} <:discord:1097815072602067016> — ${new Intl.NumberFormat("en-US").format(this.bot.statistics.databaseUsers)} <:chatgpt_blurple:1081530335306727545>`
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

		const response: Response = new Response()
			.addComponent(ActionRowBuilder<ButtonBuilder>, Introduction.buttons(this.bot))
			.setEphemeral(true);

		response.addEmbed(builder => builder
			.setTitle("Bot Statistics")
			.setColor(this.bot.branding.color)
			.setTimestamp(this.bot.statistics.since)

			.addFields(fields.map(({ key, value }) => ({
				name: key, value: value.toString(), inline: true
			})))
		);

		/* If there are partners configured in the configuration, display them here. */
		if (this.bot.branding.partners && this.bot.branding.partners.length > 0) {
			const embed: EmbedBuilder = new EmbedBuilder()
				.setTitle("Partners 🤝")
				.setColor(this.bot.branding.color)
				.setDescription(this.bot.branding.partners.map(p => `${p.emoji ? `${p.emoji} ` : ""} [**${p.name}**](${p.url})${p.description ? ` — *${p.description}*` : ""}`).join("\n"));

			response.addEmbed(embed);
		}

        return response;
    }
}