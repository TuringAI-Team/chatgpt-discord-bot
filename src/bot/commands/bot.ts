import { NoCooldown, createCommand } from "../config/setup.js";
import { CommandContext } from "../types/command.js";

export default createCommand({
	body: {
		name: "bot",
		description: "View information & statistics about the bot",
	},
	cooldown: NoCooldown,

	execute: async (ctx: CommandContext) => {
		ctx;
	},
});
