import { Guild, GuildMember, SlashCommandBuilder } from "discord.js";
import { setTimeout as delay } from "timers/promises";
import { getInfo } from "discord-hybrid-sharding";
import chalk from "chalk";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandResponse } from "../../command/command.js";
import { Bot, BotDiscordClient } from "../../bot/bot.js";
import { DatabaseUser } from "../../db/schemas/user.js";
import { Response } from "../../command/response.js";

export default class DeveloperCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("dev")
			.setDescription("View developer bot statistics")
			.addSubcommand(builder => builder
				.setName("debug")
				.setDescription("View debug information")
			)
			.addSubcommand(builder => builder
				.setName("flush")
				.setDescription("Execute all the queued database requests in all clusters")
			)
			.addSubcommand(builder => builder
				.setName("premium-roles")
				.setDescription("Give all Premium members the corresponding role on the support server")
			)
			.addSubcommand(builder => builder
				.setName("restart")
				.setDescription("Restart a specific or this cluster")
				.addIntegerOption(builder => builder
					.setName("which")
					.setDescription("Which cluster to restart")
					.setRequired(false)
					.setMaxValue(getInfo().CLUSTER_COUNT)
					.setMinValue(1)
				)
			)
			.addSubcommand(builder => builder
				.setName("reload")
				.setDescription("Restart all clusters using zero-downtime reclustering")
			)
			.addSubcommand(builder => builder
				.setName("crash")
				.setDescription("Crash the cluster")
			)
		, { long: true, restriction: [ "owner" ] });
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Which sub-command to execute */
		const action: "debug" | "restart" | "flush" | "reload" | "crash" = interaction.options.getSubcommand(true) as any;

		/* View debug information */
		if (action === "debug") {
			const runningRequests: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.conversations.filter(c => c.generating).size).catch(() => [0]))
				.reduce((value, count) => value + count, 0);

			const guilds: number[] = (await this.bot.client.cluster.fetchClientValues("guilds.cache.size")) as number[];
			const running: boolean[] = (await this.bot.client.cluster.fetchClientValues("bot.started")) as boolean[];

			/* Find the smallest starting time out of all clusters, to calculate the bot uptime. */
			const uptimes: number[] = (await this.bot.client.cluster.fetchClientValues("bot.since")) as number[];
			const uptime: number = Math.max(...uptimes);

			const fields = [
				{
					key: "Running since 🕒",
					value: `**${dayjs.duration(Date.now() - uptime).format("DD:HH:mm:ss")}**`
				},

				{
					key: "Running requests 🏓",
					value: `**\`${runningRequests}\`**`
				}
			];

			/* Debug information about the clusters */
			const clusterCount: number = getInfo().CLUSTER_COUNT;
			let clusterDebug: string = "";

			for (let i = 0; i < clusterCount; i++) {
				const clusterRunning: boolean = running[i] != undefined;
				const clusterUptime: number = uptimes[i];
				const clusterGuilds: number = guilds[i];

				if (clusterRunning) clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **${clusterGuilds}** guilds • **${dayjs.duration(Date.now() - clusterUptime).format("DD:HH:mm:ss")}**`;
				else clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **Reloading** ... ⌛`;
			}

			/* Discord gateway session limit */
			const session = await this.bot.sessionLimit();

			/* Whether enough remaining sessions are available for the bot to fully restart */
			const shardCount: number = getInfo().TOTAL_SHARDS;
			const enough: boolean = session.remaining >= shardCount;

			return new Response()
				.addEmbed(builder => builder
					.setTitle("Development Statistics")
					.setColor(this.bot.branding.color)

					.addFields(fields.map((({ key, value }) => ({
						name: key, value
					}))))
				)
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Clusters 🤖")
					.setDescription(clusterDebug.trim())
				)
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Discord session 🖥️")
					.setDescription(enough ? "There are enough sessions for the bot to fully restart ✅" : "There are **not** enough sessions for the bot to fully restart ⚠️")
					.addFields(
						{ name: "Remaining",           value: `\`${session.remaining}\`/\`${session.total}\``, inline: true },
						{ name: "Concurrency", value: `\`${session.maxConcurrency}\`/s`, inline: true },
						{ name: "Resets", value: `<t:${Math.floor((Date.now() + session.resetAfter) / 1000)}:R>`, inline: true },
						{ name: "Shards", value: `${shardCount}`, inline: true }
					)
				);

		/* Trigger a specific or this cluster */
		} else if (action === "restart") {
			const which: number = interaction.options.getInteger("which") ?? this.bot.data.id + 1;
			const index: number = which - 1;

			await interaction.editReply(new Response()
				.addEmbed(builder => builder
					.setDescription(`Restarting cluster **#${index + 1}** ...`)
					.setColor("Red")
				)
			.get());

			/* Take the easier route, and exit this cluster directly. */
			if (this.bot.data.id === index) return this.bot.stop(0);

			/* Broadcast a stop to the specific cluster. */
			else await this.bot.client.cluster.broadcastEval(((client: BotDiscordClient) => client.bot.stop(0)) as any, { cluster: index });

		/* Restart all clusters using zero-downtime reclustering */
		} else if (action === "reload") {
			await interaction.editReply(new Response()
				.addEmbed(builder => builder
					.setDescription("Restarting all clusters **...** 🫡")
					.setColor("Yellow")
				)
			.get());

			/* First, save all queued database changes. */
			await this.bot.db.queue.work();

			/* Initiate the restart. */
			await this.bot.client.cluster.evalOnManager("this.bot.restart()");

		/* Crash the cluster */
		} else if (action === "crash") {
			await interaction.editReply(new Response()
				.addEmbed(builder => builder
					.setDescription("Crashing the bot **...** 🫡")
					.setColor("Red")
				)
			.get());

			setTimeout(() => {
				eval(".");
			});

		/* Execute all the queued database requests in all clusters */
		} else if (action === "flush") {
			/* Save all pending database changes. */
			await this.bot.db.queue.work();

			return new Response()
				.addEmbed(builder => builder
					.setDescription("Done 🙏")
					.setColor("Orange")
				);
		}
    }
}