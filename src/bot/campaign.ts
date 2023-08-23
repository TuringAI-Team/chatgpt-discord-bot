import { MessageComponentTypes, ButtonStyles, type ActionRow, type Embed } from "discordeno";

import type { CampaignDisplay, CampaignRender, DBCampaign } from "../db/types/campaign.js";
import type { DBEnvironment } from "../db/types/mod.js";

import { EmbedColor } from "./utils/response.js";
import { bot } from "./mod.js";

/** List of all database campaigns */
const campaigns: DBCampaign[] = [];

/** Fetch all campaigns from the database. */
export async function fetchCampaigns() {
	campaigns.push(
		...await bot.db.all<DBCampaign>("campaigns")
	);
}

export function getCampaign(id: string) {
	return campaigns.find(c => c.id === id) ?? null;
}

export function trackingURL(campaign: DBCampaign, env: DBEnvironment) {
	return `https://l.turing.sh/${campaign.id}/${env.user.id}`;
}

/** Pick a random campaign to display, increment its views & format it accordingly.1 */
export function advertisement(env: DBEnvironment): CampaignDisplay | null {
	/* Disable all ads for Premium users. */
	const type = bot.db.premium(env);
	if (type !== null) return null;

	const campaign = pick();
	if (!campaign) return null;

	/** TODO: Increment statistics */

	return {
		campaign, response: render(campaign)
	};
}

/** Format a campaign into a nice-looking embed. */
function render(campaign: DBCampaign): CampaignRender {
	const embed: Embed = {
		title: campaign.settings.title,
		description: campaign.settings.description,

		color: campaign.settings.color
			? EmbedColor[campaign.settings.color] ?? EmbedColor.Orange
			: undefined,

		image: campaign.settings.image
			? { url: campaign.settings.image }
			: undefined,

		thumbnail: campaign.settings.thumbnail
			? { url: campaign.settings.thumbnail }
			: undefined,

		footer: { text: "This is a sponsored advertisement." }
	};

	const row: ActionRow = {
		type: MessageComponentTypes.ActionRow,

		components: [
			{
				type: MessageComponentTypes.Button,
				label: "Visit", style: ButtonStyles.Primary,
				emoji: { name: "share", id: 1122241895133884456n },
				customId: `campaign:link:${campaign.id}`
			},

			{
				type: MessageComponentTypes.Button,
				label: "Remove ads", emoji: { name: "✨" },
				style: ButtonStyles.Secondary,
				customId: "premium:ads"
			}
		]
	};

	return { embed, row };
}

/** Choose a random campaign to display. */
function pick() {
	const sorted = campaigns.filter(c => c.active && available(c));
	let final: DBCampaign = null!;

	const totalBudget: number = sorted.reduce(
		(previous, campaign) => previous + campaign.budget.total, 0
	);

	const random: number = Math.floor(Math.random() * 100) + 1;
	let start: number = 0; let end: number = 0;

	for (const campaign of sorted) {
		let percent: number = Math.round((campaign.budget.total / totalBudget) * 100);
		end += percent;

		if (percent > 20) percent = 20 - (percent - 20);
		if (percent < 5) percent = 5 + (10 - percent);

		if (random > start && random <= end) {
			final = campaign;
			break;
		}

		start += percent;
	}

	if (final === null) return null;
	return final;
}

/** Figure out whether a campaign can run, making sure that its budget is still under the limit. */
function available(campaign: DBCampaign) {
	return campaign.budget.total >= campaign.budget.used;
}