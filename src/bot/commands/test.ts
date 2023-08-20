import { DBUser } from "../../db/types/user.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "test",
	description: "Testing command",

	cooldown: {
		time: 5 * 1000
	},

	handler: async (bot, interaction) => {
		const start = Date.now();
		const user: DBUser | null = await bot.db.fetch("users", interaction.user.id);

		await bot.db.update("users", user, {
			voted: new Date().toISOString()
		});

		return {
			content: `fetched in ${Date.now() - start}ms`,
			ephemeral: true
		};
	}
});