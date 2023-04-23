import { ColorResolvable, SlashCommandBuilder } from "discord.js";

import { Command, CommandResponse } from "../command/command.js";
import { Response, ResponseType } from "../command/response.js";
import { Bot, BotStatus } from "../bot/bot.js";

import { status as statusPage, StatusSummary, StatusComponent, StatusIncident } from "../util/statuspage.js";

const StatusImpactEmojiMap: { [key: string]: string } = {
	critical: "🔴",
	major: "🟠",
	minor: "🟡",
	monitoring: "👀"
}

export const StatusTypeEmojiMap: { [key: string]: string } = {
	investigating: "🔎",
	identified: "💡",
	monitoring: "👀",
	partial_outage: "⚠️",
	degraded_performance: "🐢",
	major_outage: "‼️",
	maintenance: "🛠️",
	operational: "✅",
	resolved: "✅"
}

export const StatusTypeTitleMap: { [key: string]: string } = {
	investigating: "Investigating",
	identified: "Identified",
	partial_outage: "Partial outage",
	degraded_performance: "Degraded performance",
	major_outage: "Major outage",
	operational: "Operational",
	maintenance: "Under maintenance",
	monitoring: "Monitoring"
}

export const StatusTypeColorMap: { [key: string]: ColorResolvable } = {
	investigating: "Yellow",
	partial_outage: "Orange",
	degraded_performance: "Orange",
	major_outage: "Red",
	operational: "Green",
	maintenance: "Orange",
	identified: "Blue",
	monitoring: "White"
}

const PageStatusColorMap: { [key: string]: ColorResolvable } = {
	none: "Green",
	major: "Red",
	minor: "Orange"
}

export default class StatusCommand extends Command {
	constructor(bot: Bot) {
		super(bot, new SlashCommandBuilder()
			.setName("status")
			.setDescription("View the status of OpenAI services & the bot")
		, { long: true, always: true });
	}

    public async run(): CommandResponse {
		/* Fetch the status page by OpenAI. */
		const page: StatusSummary = await statusPage("https://status.openai.com");
		const incidents: StatusIncident[] = page.incidents.filter(i => i.updates.length > 0 && i.updates[0]?.status !== "resolved");

		/* Status of the bot */
		const status: BotStatus = await this.bot.status();

		const response: Response = new Response(ResponseType.Edit)
			.addEmbed(builder => builder
				.setTitle("Status 🧐")
				.setDescription("*Status of various services and the Discord bot*")
			)
			.addEmbed(builder => builder
				.setTitle("Discord bot")
				.addFields({
					name: `${StatusTypeTitleMap[status.type]} ${StatusTypeEmojiMap[status.type]}`,
					value: `${status.notice ? `*${status.notice}* — ` : ""}<t:${Math.floor(status.since / 1000)}:f>`
				})
				.setColor(StatusTypeColorMap[status.type] ?? "White")
			)
			.addEmbed(builder => builder
				.setTitle("OpenAI services")
				.setColor(PageStatusColorMap[page.status.indicator] ?? "White")
			)

		if (incidents.length > 0) response.addEmbed(builder => builder
			.setTitle("OpenAI incidents")
			.setColor(PageStatusColorMap[page.status.indicator] ?? "White")
			.setDescription(incidents.map(i => `**__${i.name}__** ${StatusImpactEmojiMap[i.impact] ?? "❓"}\n${i.updates.map(u => `*${u.body}* ${StatusTypeEmojiMap[u.status]} — <t:${Math.floor(u.updatedAt / 1000)}:f>`).join("\n")}`).join("\n\n"))
		);

		/* Which services to display */
		const display: string[] = [ "API", "chat.openai.com" ];
		const components: StatusComponent[] = page.components.filter(c => display.includes(c.name));

		/* Add the services to the embed fields. */
		response.embeds[2].addFields(components.map(c => ({
			name: `${c.name} — ${StatusTypeTitleMap[c.status]} ${StatusTypeEmojiMap[c.status]}`,
			value: `<t:${Math.floor(c.updatedAt / 1000)}:f>`
		})))

        return response;
    }
}