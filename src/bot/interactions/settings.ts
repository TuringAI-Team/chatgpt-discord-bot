import { createInteractionHandler } from "../helpers/interaction.js";
import { handleSettingsInteraction } from "../settings.js";

export default createInteractionHandler({
	name: "settings",

	handler: (options) => {
		return handleSettingsInteraction(options);
	}
});