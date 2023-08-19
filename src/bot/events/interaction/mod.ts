import { InteractionTypes } from "discordeno";

import type { CustomInteraction } from "../../types/discordeno.js";
import { createEvent } from "../../helpers/event.js";
import { executeCommand } from "./command.js";

export default createEvent("interactionCreate", async (bot, interaction) => {
    if (interaction.type === InteractionTypes.ApplicationCommand) {
        return await executeCommand(bot, interaction as CustomInteraction);
    }
});