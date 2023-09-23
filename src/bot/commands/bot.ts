import { BigString, Bot, ButtonComponent, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";

export default createCommand({
	body: {
		name: "bot",
		description: "View information & statistics about the bot",
	},
	cooldown: NoCooldown,

	interaction: async ({ interaction }) => {
		console.log(interaction);
		await interaction.edit({ ...(await buildInfo(interaction.bot, interaction.guildId)) });
	},
	message: async ({ message, bot }) => {
		await bot.helpers.sendMessage(message.channelId, {
			...(await buildInfo(bot, message.guildId)),
			messageReference: {
				failIfNotExists: false,
				messageId: message.id,
				guildId: message.guildId,
			},
		});
	},
});

async function buildInfo(bot: Bot, guildId?: BigString): Promise<CreateMessageOptions> {
	const shardId = guildId ? bot.gateway.calculateShardId(guildId, gatewayConfig.shards) : 0;
	const shard = bot.shards.get(shardId) ?? bot.shards.get(0)!;
	const ping = shard.rtt;

	// can change with gateway info rework
	const workers = new Set<number>();
	// biome-ignore lint/complexity/noForEach: In maps is the same.
	bot.shards.forEach((shard) => workers.add(shard.workerId));

	const stats = await bot.api.other.stats();

	return {
		embeds: [
			{
				title: "Bot Statistics",
				fields: [
					{
						name: "Servers 🖥️",
						value: `${stats.guilds}`,
						inline: true,
					},
					{
						name: "Workers & Shard 💎",
						value: `${workers.size} workers, ${bot.shards.size} shards`,
						inline: true,
					},
					{
						name: "Latency 🛰️",
						value: `${ping}ms`,
					},
				],
				color: config.brand.color,
			},
			{
				color: config.brand.color,
				title: "Partners 🤝",
				description: config.partners
					.map((p) => `${p.emoji ? `${p.emoji} ` : ""}[**${p.name}**](${p.url})${p.description ? ` — *${p.description}*` : ""}`)
					.join("\n"),
			},
		],
		components: [
			{
				type: MessageComponentTypes.ActionRow,
				components: Object.values(buttonInfo) as [ButtonComponent],
			},
		],
	};
}
