import { InteractionTypes } from "discordeno";

import type { CustomInteraction } from "../../types/discordeno.js";

import { handleInteraction } from "../../interactions/index.js";
import { createEvent } from "../../helpers/event.js";
import { executeCommand } from "./command.js";

export default createEvent("interactionCreate", async (bot, interaction) => {
	if (interaction.type === InteractionTypes.ApplicationCommand) {
		return await executeCommand(bot, interaction as CustomInteraction);
	}

	await handleInteraction(bot, interaction as CustomInteraction);
});