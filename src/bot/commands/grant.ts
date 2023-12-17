import { NoCooldown, createCommand } from "../config/setup.js";

export default createCommand({
	body: {
		name: "grant",
		description: "View information & statistics about the bot",
		options: [
			{
				name: "plan",
				type: "SubCommand",
				description: "Customize the bot for yourself",
			},
			{
				name: "subscription",
				type: "SubCommand",
				description: "Customize the bot for the entire server",
			},
		],
	},
	cooldown: NoCooldown,
	pr: true,
	interaction: async ({ interaction }) => {
		await interaction.edit({});
	},
});
