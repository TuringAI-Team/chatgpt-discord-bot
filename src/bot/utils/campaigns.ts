import { get, insert } from "./db.js";
import { Campaign } from "../../types/models/campaigns.js";
import { DiscordEmbed } from "@discordeno/bot";
import { CollectionNames } from "../../types/collections.js";
import config from "../../config.js";

async function getCampaigns() {
  const campaigns = await get({
    collection: "campaigns",
    filter: {
      active: true,
    },
  });
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
  // Calculate the sum of budgets
  const totalBudget = campaigns.reduce(
    (total, campaign) => total + campaign.budget.total,
    0
  );

  // Generate a random number between 0 and the total budget
  const randomBudget = Math.random() * totalBudget;

  let currentWeight = 0;
  for (const campaign of campaigns) {
    // Calculate the weight for the current campaign based on its budget
    const campaignWeight = campaign.budget.total;

    // Check if the random number falls within the current weight and campaign's weight
    if (
      randomBudget >= currentWeight &&
      randomBudget < currentWeight + campaignWeight
    ) {
      return campaign; // Return the selected campaign
    }

    currentWeight += campaignWeight; // Update the current weight
  }

  return undefined; // Return undefined if no campaign is selected (this should be rare)
}

export async function generateCampaignEmbed() {
  // TODO: generate embed @latitu
  const campaign = await getCampaign();
  if (!campaign) {
    return;
  }
  const embed: DiscordEmbed = {
    title: campaign.settings.title,
  };
  if (campaign.settings.color) {
    if (campaign.settings.color.startsWith("#")) {
      embed.color = parseInt(campaign.settings.color.replace("#", ""), 16);
    } else {
      embed.color = config.brand.color;
    }
  } else {
    embed.color = config.brand.color;
  }
  if (campaign.settings.description) {
    embed.description = campaign.settings.description;
  }
  if (campaign.settings.image) {
    embed.image = {
      url: campaign.settings.image,
    };
  }
  if (campaign.settings.thumbnail) {
    embed.thumbnail = {
      url: campaign.settings.thumbnail,
    };
  }
  return {
    embed,
    id: campaign.id,
    button: campaign.settings.button || "Click here",
  };
}
