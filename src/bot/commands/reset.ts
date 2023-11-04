import { BigString, Bot, ButtonComponent, CreateMessageOptions, MessageComponentTypes } from "@discordeno/bot";
import config from "../../config.js";
import { NoCooldown, buttonInfo, createCommand } from "../config/setup.js";
import { gatewayConfig } from "../index.js";
import { resetConversation } from "../utils/conversations.js";

export default createCommand({
	body: {
		name: "reset",
		description: "Reset your current conversation",
	},
	cooldown: NoCooldown,
	isPrivate: true,
	interaction: async ({ interaction }) => {
		await interaction.edit({
			embeds: [
				{
					title: "Resetting conversation...",
					description: "Please wait while we reset your conversation",
					color: config.brand.color,
				},
			],
		});
		await resetConversation(interaction.user.id.toString(), "openchat");
		await interaction.edit({
			embeds: [
				{
					title: "Conversation reset",
					description: "Your conversation has been reset",
					color: config.brand.color,
				},
			],
		});
	},
});
