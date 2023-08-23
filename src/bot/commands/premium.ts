import { createCommand } from "../helpers/command.js";
import { buildOverview } from "../premium.js";

export default createCommand({
	name: "premium",
	description: "View information about Premium & your current subscription",

	handler: async ({ bot, env, interaction }) => {
		return buildOverview(bot, interaction, env);
	}
});