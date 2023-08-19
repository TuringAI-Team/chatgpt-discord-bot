import { createCommand } from "../helpers/command.js";

export default createCommand({
	name: "test",
	description: "Testing command",

	cooldown: {
		time: 20 * 1000
	},

	handler: () => {
		return {
			content: "tested"
		};
	}
});