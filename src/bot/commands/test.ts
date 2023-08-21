import { RestrictionType } from "../utils/restriction.js";
import { createCommand } from "../helpers/command.js";
import { DBUser } from "../../db/types/user.js";

export default createCommand({
	name: "test",
	description: "Testing command",

	restrictions: [ RestrictionType.Developer ],

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