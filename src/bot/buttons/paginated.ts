import { ButtonResponse } from "../types/command.js";
import { HandleAction } from "../utils/paginated.js";

export const paginated: ButtonResponse = {
	id: "paginated",
	args: ["action", "id"],
	run: async (interaction, data) => {
		await interaction.bot.pages.get(data.id)!.handleButton(data.action as HandleAction);
	},
};

export default paginated;
