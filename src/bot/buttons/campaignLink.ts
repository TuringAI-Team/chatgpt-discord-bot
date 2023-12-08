import { ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";
import { get, update } from "../utils/db.js";
import { Campaign } from "../../types/models/campaigns.js";

export const campaignLink: ButtonResponse = {
	id: "campaign",
	args: ["id"],
	isPrivate: true,
	run: async (interaction, data) => {
		const campaignInfo = (await get({
			collection: "campaigns",
			id: data.id,
		})) as Campaign;
		await update("campaigns", data.id, {
			stats: {
				views: campaignInfo?.stats.views,
				clicks: {
					geo: campaignInfo.stats.clicks.geo,
					total: campaignInfo.stats.clicks.total + 1,
				},
			},
		});
		await interaction.edit({
			components: [
				{
					type: MessageComponentTypes.ActionRow,
					components: [
						{
							type: MessageComponentTypes.Button,
							label: "Click here",
							url: `https://l.turing.sh/${data.id}/${interaction.user.id}`,
							style: ButtonStyles.Link,
						},
					] as [ButtonComponent],
				},
			],
		});
	},
};

export default campaignLink;
