import { ButtonComponent, ButtonStyles, MessageComponentTypes } from "@discordeno/bot";
import { ButtonResponse } from "../types/command.js";

export const campaignLink: ButtonResponse = {
	id: "campaign",
	args: ["id"],
	isPrivate: true,
	run: async (interaction, data) => {
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
