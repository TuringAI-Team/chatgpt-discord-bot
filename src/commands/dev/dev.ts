import { getInfo } from "discord-hybrid-sharding";
import { SlashCommandBuilder } from "discord.js";
import prettyBytes from "pretty-bytes";
import NodeCache from "node-cache";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { SessionCostProducts } from "../../conversation/session.js";
import { Bot, BotDiscordClient } from "../../bot/bot.js";
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
		, { long: true, private: CommandPrivateType.OwnerOnly });
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Which sub-command to execute */
		const action: "debug" | "restart" | "flush" = interaction.options.getSubcommand(true) as any;

		/* View debug information */
		if (action === "debug") {
			const count: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.session.debug.count))
				.reduce((value, count) => value + count, 0);

			const tokens: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.session.debug.tokens))
				.reduce((value, count) => value + count, 0);

			const runningRequests: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.conversations.filter(c => c.generating).size))
				.reduce((value, count) => value + count, 0);

			const cache: NodeCache.Stats = ((await this.bot.client.cluster.broadcastEval(() => this.bot.db.cache.cache.stats)) as NodeCache.Stats[])
				.reduce((value, stats) => ({
					hits: value.hits + stats.hits,
					keys: value.keys + stats.keys,
					ksize: value.ksize + stats.ksize,
					misses: value.misses + stats.misses,
					vsize: value.vsize + stats.vsize
				}), {
					hits: 0, keys: 0, ksize: 0, misses: 0, vsize: 0
				});

			/*const uptime: number[] = (await this.bot.client.cluster.fetchClientValues("bot.since")) as number[];
			const guilds: number[] = (await this.bot.client.cluster.fetchClientValues("guilds.cache.size")) as number[];*/
			const running: boolean[] = (await this.bot.client.cluster.fetchClientValues("bot.started")) as boolean[];

			const fields = [
				{
					key: "Processed messages 💬",
					value: `**\`${count}\`** (\`${new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(SessionCostProducts[0].calculate({ completion: tokens, prompt: tokens }).completion)}\`)`
				},

				{
					key: "Running requests 🏓",
					value: `**\`${runningRequests}\`**`
				}
			];

			/* Debug information about the clusters */
			/*const clusterCount: number = getInfo().CLUSTER_COUNT;
			let clusterDebug: string = "";

			for (let i = 0; i < clusterCount; i++) {
				const clusterUptime: number = uptime[i];
				const clusterGuilds: number = guilds[i];
				const clusterRunning: boolean = running[i] != undefined;

				if (clusterRunning) clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **${clusterGuilds}** guilds • **${dayjs.duration(Date.now() - clusterUptime).format("HH:mm:ss")}**`;
				else clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **Reloading** ... ⌛`;
			}*/

			/* Get information about the Stable Horde API user. */
			const user = await this.bot.image.findUser();

			return new Response()
				.addEmbed(builder => builder
					.setTitle("Development Statistics")
					.setColor(this.bot.branding.color)

					.addFields(fields.map((({ key, value }) => ({
						name: key, value
					}))))
				)
				/*.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Clusters 🤖")
					.setDescription(
						clusterDebug.trim()
					)
				)*/
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Guilds 💻")
					.setDescription(!running.every(Boolean) ? "*Reloading* ..." : null)
					.addFields(...this.bot.statistics.guilds.map((guild, index) => ({
						name: `${index + 1}. — ${guild.name}`,
						value: `**${guild.members}** members`
					})))
				)
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Cache ⚙️")
					.addFields(
						{ name: "Entries", value: `${cache.keys}`, inline: true },
						{ name: "Hits", value: `${cache.hits}`, inline: true },
						{ name: "Misses", value: `${cache.misses}`, inline: true },
						{ name: "Size", value: `${prettyBytes(cache.vsize + cache.ksize)}`, inline: true }
					)
				)
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Stable Horde 🖼️")
					.addFields(
						{ name: "Kudos",            value: `${user.kudos}`, inline: true                 },
						{ name: "Generated images", value: `${user.records.request.image}`, inline: true }
					)
				);

		/* Trigger a specific or this cluster */
		} else if (action === "restart") {
			const which: number = interaction.options.getInteger("which") ?? getInfo().CLUSTER + 1;
			const index: number = which - 1;

			await interaction.editReply(new Response()
				.addEmbed(builder => builder
					.setDescription(`Restarting cluster **#${index + 1}** ...`)
					.setColor("Red")
				)
			.get());

			/* Take the easier route, and exit this cluster directly. */
			if (getInfo().CLUSTER === index) return this.bot.stop(0);

			/* Broadcast a stop to the specific cluster. */
			else await this.bot.client.cluster.broadcastEval(((client: BotDiscordClient) => client.bot.stop(0)) as any, { cluster: index });

		/* Execute all the queued database requests in all clusters */
		} else if (action === "flush") {
			await this.bot.client.cluster.broadcastEval(((client: BotDiscordClient) => client.bot.db.users.workOnQueue()) as any);

			return new Response()
				.addEmbed(builder => builder
					.setDescription("Done 🙏")
					.setColor("Orange")
				);
		}
    }
}