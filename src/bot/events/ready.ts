import { EventHandlers, logger } from "@discordeno/bot";

export const ready: EventHandlers["ready"] = async (payload) => {
	logger.info(`[READY] Shard ID #${payload.shardId} is ready.`);
};
