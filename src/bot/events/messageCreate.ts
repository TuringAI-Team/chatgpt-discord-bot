import { EventHandlers, InteractionTypes, logger } from "@discordeno/bot";
import { commands } from "../index.js";

export const messageCreate: EventHandlers["messageCreate"] = async (message) => {
	console.log(message);
};
