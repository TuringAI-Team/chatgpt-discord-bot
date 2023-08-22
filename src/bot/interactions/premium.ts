import { ButtonStyles, MessageComponentTypes } from "discordeno";

import { createInteractionHandler } from "../helpers/interaction.js";
import { EmbedColor } from "../utils/response.js";

export default createInteractionHandler({
	name: "premium",

	handler: (options) => {
		const action = options.args[0];

		if (action === "purchase") {
			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: "Visit our shop", emoji: { name: "💸" },
							url: "https://app.turing.sh/pay",
							style: ButtonStyles.Link
						}
					]
				} ],

				ephemeral: true
			};

		} else if (action === "ads") {
			const perks = [
				"Way lower cool-down for chatting & commands",
				"Bigger character limit for chatting",
				"Early access to new features"
			];

			return {
				components: [ {
					type: MessageComponentTypes.ActionRow,

					components: [
						{
							type: MessageComponentTypes.Button,
							label: "Visit our shop", emoji: { name: "💸" },
							url: "https://app.turing.sh/pay",
							style: ButtonStyles.Link
						}
					]
				} ],

				embeds: {
					title: "Want to get rid of annoying ads? ✨",
					description: `**Premium** gets rid of all ads in the bot & also gives you additional benefits, such as\n\n${perks.map(p => `- ${p}`).join("\n")}`,
					color: EmbedColor.Orange
				},

				ephemeral: true
			};
		}
	}
});