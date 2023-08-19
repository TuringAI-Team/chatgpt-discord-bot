import type { Transformers } from "discordeno";

import type { Transformer } from "../transformers/index.js";
import { DiscordBot } from "../index.js";

export function createTransformer<T extends keyof Transformers>(
	name: T, handler: (bot: DiscordBot, ...args: any[]) => unknown
): Transformer<T> {
	return  {
		name, handler
	};
}