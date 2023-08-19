import type { EventHandlers } from "discordeno";

import type { Args, ReplaceBot } from "../types/args.js";
import { bot } from "../index.js";

import InteractionCreate from "./interaction/index.js";
import MessageCreate from "./message/create.js";

export interface Event<T extends keyof EventHandlers> {
    name: T;
    handler: ReplaceBot<Args<EventHandlers[T]>>;
}

const EVENTS = [
	InteractionCreate, MessageCreate
];

export function setupEvents() {
	for (const event of EVENTS) {
		bot.events[event.name] = event.handler as any;
	}
}