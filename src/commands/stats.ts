import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, SlashCommandBuilder } from "discord.js";

import { Command, CommandInteraction, CommandResponse } from "../command/command.js";
import { Response, ResponseType } from "../command/response.js";
import { Utils } from "../util/utils.js";
import { Bot } from "../bot/bot.js";

export default class StatisticsCommand extends Command {
    constructor(bot: Bot) {
        super(bot,
            new SlashCommandBuilder()
                .setName("stats")
                .setDescription("View information & statistics about the bot")
		, { long: true, always: true, cooldown: 10 * 1000 });
    }

    public async run(interaction: CommandInteraction): CommandResponse {
		if (!this.bot.started) return new Response()
			.addEmbed(builder => builder
				.setDescription("The bot is currently reloading **...**")
				.setColor("Orange")
			)
			.setEphemeral(true);

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

		const row = new ActionRowBuilder<ButtonBuilder>()
			.addComponents(
                new ButtonBuilder()
                    .setURL(Utils.inviteLink(this.bot))
                    .setLabel("Add me to your server")
                    .setStyle(ButtonStyle.Link),

                new ButtonBuilder()
                    .setURL(Utils.supportInvite(this.bot))
                    .setLabel("Support server")
                    .setStyle(ButtonStyle.Link),

				new ButtonBuilder()	
					.setURL("https://github.com/TuringAI-Team/chatgpt-discord-bot")
					.setEmoji("<:github:1097828013871222865>")
					.setStyle(ButtonStyle.Link)
					.setLabel("GitHub"),

				new ButtonBuilder()	
					.setURL("https://bit.ly/chatgpt-whatsapp")
                    .setEmoji("<:WhatsApp:1079831241601323078>")
					.setStyle(ButtonStyle.Link)
					.setLabel("WhatsApp bot"),
			);

        return new Response(ResponseType.Edit)
            .addEmbed(builder)
			.addComponent(ActionRowBuilder<ButtonBuilder>, row);
    }
}