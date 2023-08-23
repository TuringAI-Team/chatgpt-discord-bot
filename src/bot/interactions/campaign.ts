import { ButtonStyles, MessageComponentTypes } from "discordeno";

import { createInteractionHandler } from "../helpers/interaction.js";
import { getCampaign, trackingURL } from "../campaign.js";

export default createInteractionHandler({
	name: "campaign",

	handler: ({ env, args }) => {
		const action = args[0];

		if (action === "link") {
			const campaign = getCampaign(args[1]);
			if (!campaign) return;

			const url = trackingURL(campaign, env);
			const domain = new URL(campaign.link).hostname;

			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: domain, url, style: ButtonStyles.Link
						}
					]
				} ],

				ephemeral: true
			};
		}
	}
});