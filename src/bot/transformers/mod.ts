import type { Transformers } from "discordeno";

import { type DiscordBot, bot } from "../mod.js";

import Interaction from "./interaction.js";
import Message from "./message.js";

export interface Transformer<T extends keyof Transformers, Transformed, Raw> {
    name: T;
    handler: (bot: DiscordBot, transformedPayload: Transformed, raw: Raw) => unknown;
}

const TRANSFORMERS: Transformer<keyof Transformers, any, any>[] = [
	Interaction, Message
];

export function setupTransformers() {
	for (const transformer of TRANSFORMERS) {
		const oldTransformer = bot.transformers[transformer.name];

		bot.transformers[transformer.name] = ((bot: DiscordBot, payload: unknown) => {
			const transformed = (oldTransformer as any)(bot, payload);

			return transformer.handler(bot, transformed, payload);
		}) as any;
	}
}