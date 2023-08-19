import type { EventHandlers } from "discordeno";

import type { Args, ReplaceBot } from "../types/args.js";
import type { Event } from "../events/mod.js";

export function createEvent<T extends keyof EventHandlers>(
    name: T, handler: ReplaceBot<Args<EventHandlers[T]>>
): Event<T> {
    return  {
        name, handler
    };
}