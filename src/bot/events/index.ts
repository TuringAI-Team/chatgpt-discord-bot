import type { EventHandlers } from "@discordeno/bot";
import { ready } from "./ready.js";
import { interactionCreate } from "./interactioncreate.js";

export const events: Partial<EventHandlers> = {
	ready,
	interactionCreate,
};
