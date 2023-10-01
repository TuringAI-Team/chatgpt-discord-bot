import { get, insert } from "./db.js";
import { Campaign } from "../../types/models/campaigns.js";

async function getCampaigns() {
	const campaigns = await get({
		collection: "campaigns",
		filter: [
			{
				column: "active",
				operator: "eq",
				value: "true",
			},
		],
	});
	console.log(campaigns);
	if (!campaigns) {
		return [];
	}
	return campaigns as Campaign[];
}

export async function getCampaign() {
	const campaigns = await getCampaigns();
	const campaign = await checkCampaigns(campaigns);
	return campaign;
}

async function checkCampaigns(campaigns: Campaign[]) {
	let finalCampaign;

	const totalBudget = campaigns.reduce((acc, campaign: Campaign) => acc + (campaign.budget.total - campaign.budget.used), 0);

	const random = Math.floor(Math.random() * 100) + 1;

	let start = 0;
	let end = 0;
	for (let i = 0; i < campaigns.length; i++) {
		const campaign = campaigns[i];
		let percent = Math.round(((campaign.budget.total - campaign.budget.used) / totalBudget) * 100);
		if (percent > 20) {
			percent = 20 - (percent - 20);
		}
		if (percent < 5) {
			percent = 5 + (10 - percent);
		}
		end += percent;
		if (random > start && random <= end) {
			finalCampaign = campaigns[i];
			break;
		}
		start += percent;
	}
	console.log(finalCampaign); // this is the campaign to display
	return finalCampaign;
}

export async function generateEmbed() {
	// TODO: generate embed @latitu
}
