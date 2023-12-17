import { BigString, Bot, ButtonComponent, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { resetConversation } from "../utils/conversations.js";
import { getDefaultValues, getSettingsValue } from "../utils/settings.js";

export default createCommand({
	body: {
		name: "translate",
		type: "Message",
		description: "Translate a message",
	},
	cooldown: NoCooldown,
	isPrivate: true,
	interaction: async ({ interaction, env }) => {},
});
