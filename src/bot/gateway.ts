import { Bot, DiscordGatewayPayload, DiscordMessage, GatewayEventNames, handleInteractionCreate, handleReady } from "@discordeno/bot";
import { ShardInfo } from "../types/other.js";
import { messageCreate } from "./events/messageCreate.js";

export type TuringGatewayEventNames = GatewayEventNames | "SHARD_INFO";

export interface TuringGatewayPayload extends Omit<DiscordGatewayPayload, "t"> {
	/** The event name for this payload */
	t: TuringGatewayEventNames | null;
}

export const handleGatewayMessage = (bot: Bot, payload: TuringGatewayPayload, shardId: number) => {
	switch (payload.t) {
		case "READY":
			handleReady(bot, payload as DiscordGatewayPayload, shardId);
			break;
		case "INTERACTION_CREATE":
			handleInteractionCreate(bot, payload as DiscordGatewayPayload);
			break;
		case "MESSAGE_CREATE":
			messageCreate(bot.transformers.message(bot, payload.d as DiscordMessage), bot);
			break;
		case "SHARD_INFO":
			for (const info of payload.d as ShardInfo[]) {
				bot.shards.set(info.id, info);
			}
			break;
		default:
			break;
	}
};
