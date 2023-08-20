import { DBUser } from "../../db/types/user.js";
import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "test",
	description: "Testing command",

	cooldown: {
		time: 5 * 1000
	},

	handler: async ({ bot, interaction }) => {
		const start = Date.now();
		await bot.db.fetch<DBUser>("users", interaction.user.id);

		return {
			content: `fetched in ${Date.now() - start}ms`,
			ephemeral: true
		};
	}
});