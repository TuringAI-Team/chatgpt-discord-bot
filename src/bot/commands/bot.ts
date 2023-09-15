import { BRANDING_COLOR, NoCooldown, SUPPORT_INVITE } from "../../config.js";
import { createCommand } from "../config/setup.js";
import type { Command } from "../types/index.js";

export default createCommand({
	body: {
		name: "bot",
		description: "View information & statistics about the bot",
	},
	cooldown: NoCooldown,

	execute: async (ctx: NonNullable<unknown>) => {
		console.log(ctx);
	},
});
