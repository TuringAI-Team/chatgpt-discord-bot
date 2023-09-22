import type { EventHandlers } from "@discordeno/bot";
import { interactionCreate } from "./interactioncreate.js";
import { ready } from "./ready.js";

export const events: Partial<EventHandlers> = {
	ready,
	interactionCreate,
};
