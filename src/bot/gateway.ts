import { Bot, DiscordGatewayPayload, handleInteractionCreate, handleReady } from "@discordeno/bot";

export const handleGatewayMessage = (bot: Bot, payload: DiscordGatewayPayload, shardId: number) => {
	switch (payload.t) {
		case "READY":
			handleReady(bot, payload, shardId);
			break;
		case "INTERACTION_CREATE":
			handleInteractionCreate(bot, payload);
			break;
		default:
			break;
	}
};
