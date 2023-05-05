import { Guild, GuildMember, SlashCommandBuilder } from "discord.js";
import { setTimeout as delay } from "timers/promises";
import { getInfo } from "discord-hybrid-sharding";
import prettyBytes from "pretty-bytes";
import NodeCache from "node-cache";
import chalk from "chalk";
import dayjs from "dayjs";

import { Command, CommandInteraction, CommandPrivateType, CommandResponse } from "../../command/command.js";
import { SessionCostProducts } from "../../conversation/session.js";
import { RawDatabaseUser } from "../../db/managers/user.js";
import { Bot, BotDiscordClient } from "../../bot/bot.js";
import { PREMIUM_ROLE_ID } from "../../util/roles.js";
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
		, { long: true, private: CommandPrivateType.OwnerOnly });
	}

    public async run(interaction: CommandInteraction): CommandResponse {
		/* Which sub-command to execute */
		const action: "debug" | "restart" | "flush" | "premium-roles" | "reload" | "crash" = interaction.options.getSubcommand(true) as any;

		/* View debug information */
		if (action === "debug") {
			const count: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.session.debug.count))
				.reduce((value, count) => value + count, 0);

			const tokens: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.session.debug.tokens))
				.reduce((value, count) => value + count, 0);

			const runningRequests: number = (await this.bot.client.cluster.broadcastEval(() => this.bot.conversation.conversations.filter(c => c.generating).size))
				.reduce((value, count) => value + count, 0);

			const cache: NodeCache.Stats =
				await this.bot.client.cluster.evalOnManager("this.bot.app.cache.cache.stats") as unknown as NodeCache.Stats;

			const guilds: number[] = (await this.bot.client.cluster.fetchClientValues("guilds.cache.size")) as number[];
			const running: boolean[] = (await this.bot.client.cluster.fetchClientValues("bot.started")) as boolean[];

			/* Find the smallest starting time out of all clusters, to calculate the bot uptime. */
			const uptimes: number[] = (await this.bot.client.cluster.fetchClientValues("bot.since")) as number[];
			const uptime: number = Math.max(...uptimes);

			const fields = [
				{
					key: "Running since 🕒",
					value: `**${dayjs.duration(Date.now() - uptime).format("HH:mm:ss")}**`
				},

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
			const clusterCount: number = getInfo().CLUSTER_COUNT;
			let clusterDebug: string = "";

			for (let i = 0; i < clusterCount; i++) {
				const clusterRunning: boolean = running[i] != undefined;
				const clusterUptime: number = uptimes[i];
				const clusterGuilds: number = guilds[i];

				if (clusterRunning) clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **${clusterGuilds}** guilds • **${dayjs.duration(Date.now() - clusterUptime).format("HH:mm:ss")}**`;
				else clusterDebug = `${clusterDebug}\n\`#${i + 1}\` • **Reloading** ... ⌛`;
			}

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
				.addEmbed(builder => builder
					.setColor(this.bot.branding.color)
					.setTitle("Clusters 🤖")
					.setDescription(
						clusterDebug.trim()
					)
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
			await this.bot.client.cluster.broadcastEval(((client: BotDiscordClient) => client.bot.db.users.workOnQueue()) as any);

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

		/* Give all Premium members the corresponding role on the support server */
		} else if (action === "premium-roles") {
			/* Fetch all Premium users from the database. */
			const { data, error } = await this.bot.db.client
				.from(this.bot.db.users.collectionName("users"))
				.select("*")
				.neq("subscription", null);

			if (data === null || error !== null) return new Response()
				.addEmbed(builder => builder
					.setDescription("Something went while fetching all Premium users from the database 😕")
					.setColor("Red")
				)
				.setEphemeral(true);

			/* Raw database users */
			const users: RawDatabaseUser[] = (data as RawDatabaseUser[])
				.map(user => ({ ...user, subscription: this.bot.db.users.subscription(user) }));

			const members: GuildMember[] = [];

			/* Support server */
			const guild: Guild = this.bot.client.guilds.cache.get(this.bot.app.config.channels.moderation.guild)!;
			
			/* Counters */
			const total: number = users.length;
			let current: number = 0;

			const progress = (member: GuildMember, current: number, total: number) => {
				interaction.editReply(new Response()
					.addEmbed(builder => builder
						.setDescription(`Working on member **<@${member.user.id}>**... [**${current + 1}**/**${total}**]`)
						.setColor("Yellow")
					)
				.get());
			}

			/* Find all corresponding members on the support server. */
			for (const db of users.filter(db => !db.id.includes("@"))) {
				if (db.subscription === null) continue;
				const member = await guild.members.fetch(db.id).catch(() => null) ?? null;

				if (member !== null && !member.roles.cache.has(PREMIUM_ROLE_ID)) {
					this.bot.logger.debug(`Premium member ${chalk.bold(member.user.tag)} has been fetched. [${chalk.bold(current + 1)}/${chalk.bold(users.length)}]`);

					if (current % 5 === 0) progress(member, current, total);
					current++;

					/* Give the user their Premium role. */
					await member.roles.add(PREMIUM_ROLE_ID);

					await delay(500);
					members.push(member);
				} else {
					continue;
				}
			}

			if (members.length === 0) {
				return new Response()
					.addEmbed(builder => builder
						.setDescription("All Premium members already have the role 🎉")
						.setColor("Green")
					);

			} else {
				return new Response()
					.addEmbed(builder => builder
						.setDescription(`**${current}** Premium members have received the role 🎉`)
						.setColor("Green")
					);
			}

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