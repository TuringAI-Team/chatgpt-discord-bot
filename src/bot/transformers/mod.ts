import type { Transformers } from "discordeno";

import { type DiscordBot, bot } from "../mod.js";

import Interaction from "./interaction.js";
import Message from "./message.js";

export interface Transformer<T extends keyof Transformers> {
    name: T;
    handler: (bot: DiscordBot, ...args: unknown[]) => unknown;
}

const TRANSFORMERS: Transformer<keyof Transformers>[] = [
	Interaction, Message
];

export function setupTransformers() {
	for (const transformer of TRANSFORMERS) {
		const old = bot.transformers[transformer.name];

		bot.transformers[transformer.name] = ((bot: DiscordBot, payload: unknown) => {
			payload = (old as any)(bot, payload);
			return transformer.handler(bot, payload);
		}) as any;
	}
}