import type { DiscordBot } from "../index.js";

type Tail<T extends any[]> = T extends [any, ...infer U] ? U : never;

/* Complicated stuff to replace the Bot instance in the arguments with DiscordBot */
export type Args<T> = T extends (...args: infer U) => unknown ? U : never;
export type ReplaceBot<T extends any[], U = Promise<void> | void> = (bot: DiscordBot, ...args: Tail<T>) => U;