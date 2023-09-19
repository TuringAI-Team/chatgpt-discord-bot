import { createCommand } from "../config/setup.js";

export default createCommand({
	body: {
		name: "bot",
		description: "View information & statistics about the bot",
	},
	cooldown: { subscription: 0, user: 0, voter: 0 },

	execute: async (ctx: NonNullable<unknown>) => {
		console.log(ctx);
	},
});
